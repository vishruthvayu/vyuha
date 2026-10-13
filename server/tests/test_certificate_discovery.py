"""Discovery contracts are exercised on this OS, not native Windows validation."""
import importlib.util
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/make-cert.py'
spec = importlib.util.spec_from_file_location('vyuha_local_certificate', SCRIPT)
certificate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(certificate)


def binary(root, name='usr/bin/openssl.exe'):
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('Discovery fixture only; never executed')
    return path


def test_explicit_override_precedes_path_and_invalid_override_never_falls_back(monkeypatch):
    seen = []

    def which(name):
        seen.append(name)
        return {'approved openssl': '/approved executable', 'openssl': '/PATH executable'}.get(name)

    monkeypatch.setattr(certificate.shutil, 'which', which)
    assert certificate.find_openssl('approved openssl', windows=True) == '/approved executable'
    assert certificate.find_openssl('missing executable', windows=True) is None
    assert seen == ['approved openssl', 'missing executable']


def test_path_openssl_precedes_git_and_known_install_directories(monkeypatch):
    monkeypatch.setattr(certificate.shutil, 'which', lambda name: '/path/openssl' if name == 'openssl' else pytest.fail('Must not search Git when PATH already provides OpenSSL'))
    assert certificate.find_openssl(windows=True, environ={}) == '/path/openssl'


@pytest.mark.parametrize('git_layout', ['cmd/git.exe', 'bin/git.exe', 'mingw64/bin/git.exe'])
def test_git_executable_discovers_portable_install_with_spaces(tmp_path, monkeypatch, git_layout):
    root = tmp_path / 'Custom portable Git'
    git, openssl = binary(root, git_layout), binary(root)
    monkeypatch.setattr(certificate.shutil, 'which', lambda name: str(git) if name == 'git' else None)
    assert certificate.find_openssl(windows=True, environ={}) == str(openssl)


@pytest.mark.parametrize('variable', ['ProgramW6432', 'ProgramFiles', 'ProgramFiles(x86)', 'LOCALAPPDATA'])
def test_known_windows_install_roots(tmp_path, monkeypatch, variable):
    base = tmp_path / 'Windows installation path'
    root = base / ('Programs/Git' if variable == 'LOCALAPPDATA' else 'Git')
    openssl = binary(root)
    monkeypatch.setattr(certificate.shutil, 'which', lambda name: None)
    assert certificate.find_openssl(windows=True, environ={variable: str(base)}) == str(openssl)


def test_missing_or_directory_executable_returns_actionable_failure(tmp_path, monkeypatch):
    base = tmp_path / 'Program Files'
    (base / 'Git/usr/bin/openssl.exe').mkdir(parents=True)
    monkeypatch.setattr(certificate.shutil, 'which', lambda name: None)
    assert certificate.find_openssl(windows=True, environ={'ProgramFiles': str(base)}) is None


def test_non_windows_does_not_inspect_windows_installations(tmp_path, monkeypatch):
    binary(tmp_path / 'Git')
    monkeypatch.setattr(certificate.shutil, 'which', lambda name: None)
    assert certificate.find_openssl(windows=False, environ={'ProgramFiles': str(tmp_path)}) is None


def test_invalid_explicit_cli_override_does_not_create_keys(tmp_path):
    out = tmp_path / 'certificates'
    result = subprocess.run([sys.executable, str(SCRIPT), '--ip', '192.168.1.17', '--openssl', str(tmp_path / 'missing openssl'), '--out', str(out)], capture_output=True, text=True)
    assert result.returncode == 2
    assert 'explicit invalid override is never replaced' in result.stderr
    assert not out.exists()


@pytest.mark.skipif(not shutil.which('openssl'), reason='Optional local certificate verification requires OpenSSL')
def test_actual_generated_ca_fingerprint_matches_manual_trust_instructions(tmp_path):
    out = tmp_path / 'certificates with spaces'
    result = subprocess.run([sys.executable, str(SCRIPT), '--ip', '192.168.1.17', '--out', str(out)], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    expected = subprocess.run(['openssl', 'x509', '-in', str(out / 'ca.crt'), '-noout', '-sha256', '-fingerprint'], check=True, capture_output=True, text=True).stdout.strip()
    assert expected in result.stdout
    assert 'certmgr.msc' in result.stdout and 'CA certificate' in result.stdout
    assert 'only ca.crt' in result.stdout
    assert 'No system trust store was changed' in result.stdout
