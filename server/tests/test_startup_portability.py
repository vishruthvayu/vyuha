"""Executable launcher contracts on the current OS, not native OS certification."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]


def _project(tmp_path, layout):
    root = tmp_path / "officer path with spaces"
    (root / "scripts").mkdir(parents=True)
    for name in ("python-runtime.sh", "start-local.sh", "start-unit.sh", "preflight.py"):
        shutil.copyfile(ROOT / "scripts" / name, root / "scripts" / name)
    (root / "client" / "dist").mkdir(parents=True)
    (root / "client" / "dist" / "index.html").write_text("prepared locally")
    (root / "client" / "node_modules").mkdir()
    interpreter = root / ".venv" / layout
    interpreter.parent.mkdir(parents=True)
    interpreter.write_text(
        f"#!{sys.executable}\n"
        "import json,os,sys\n"
        "with open(os.environ['VYUHA_FAKE_LOG'],'a') as f: f.write(json.dumps(sys.argv[1:])+'\\n')\n"
        "if sys.argv[1:] == ['scripts/lan-addresses.py']: print('10.23.4.5')\n"
    )
    interpreter.chmod(0o755)
    command_dir = root / "fake commands"
    command_dir.mkdir()
    npm = command_dir / "npm"
    npm.write_text(
        f"#!{sys.executable}\n"
        "import json,os,sys\n"
        "with open(os.environ['VYUHA_FAKE_NPM_LOG'],'a') as f: f.write(json.dumps(sys.argv[1:])+'\\n')\n"
    )
    npm.chmod(0o755)
    env = {
        **os.environ,
        "VYUHA_FAKE_LOG": str(root / "python-calls.jsonl"),
        "VYUHA_FAKE_NPM_LOG": str(root / "npm-calls.jsonl"),
        "PATH": str(command_dir) + os.pathsep + os.environ.get("PATH", ""),
        "VYUHA_PORT": "8143",
        "VYUHA_SSL_CERTFILE": "",
        "VYUHA_SSL_KEYFILE": "",
        "OSTYPE": "msys" if layout.startswith("Scripts") else "linux-gnu",
    }
    return root, env


@pytest.mark.parametrize("layout", ["bin/python", "Scripts/python.exe"])
def test_unit_launcher_resolves_both_venv_layouts_without_installing(tmp_path, layout):
    root, env = _project(tmp_path, layout)
    result = subprocess.run(["bash", "scripts/start-unit.sh"], cwd=root, env=env, capture_output=True, text=True, timeout=10)
    assert result.returncode == 0, result.stderr
    calls = [json.loads(line) for line in (root / "python-calls.jsonl").read_text().splitlines()]
    assert calls[0] == ["scripts/preflight.py"]
    assert calls[-1] == ["-m", "uvicorn", "server.main:app", "--no-access-log", "--host", "0.0.0.0", "--port", "8143"]
    assert all("pip" not in call and "venv" not in call for call in calls)
    assert not (root / "npm-calls.jsonl").exists()
    assert "http://10.23.4.5:8143" in result.stdout


@pytest.mark.parametrize("layout", ["bin/python", "Scripts/python.exe"])
def test_local_launcher_preserves_prepared_env_and_quotes_paths(tmp_path, layout):
    root, env = _project(tmp_path, layout)
    result = subprocess.run(["bash", "scripts/start-local.sh"], cwd=root, env=env, capture_output=True, text=True, timeout=10)
    assert result.returncode == 0, result.stderr
    calls = [json.loads(line) for line in (root / "python-calls.jsonl").read_text().splitlines()]
    assert calls[0] == ["scripts/preflight.py", "--build"]
    assert calls[-1] == ["-m", "uvicorn", "server.main:app", "--host", "127.0.0.1", "--port", "8143"]
    assert all("pip" not in call and "venv" not in call for call in calls)
    assert json.loads((root / "npm-calls.jsonl").read_text()) == ["run", "build"]


def test_unit_build_flag_is_not_position_dependent_and_tls_paths_are_quoted(tmp_path):
    root, env = _project(tmp_path, "Scripts/python.exe")
    env.update(VYUHA_SSL_CERTFILE=str(root / "cert with spaces.pem"), VYUHA_SSL_KEYFILE=str(root / "key with spaces.pem"))
    # The fake interpreter tests argument transport; real preflight checks files separately.
    result = subprocess.run(["bash", "scripts/start-unit.sh", "--port", "8143", "--build"], cwd=root, env=env, capture_output=True, text=True, timeout=10)
    assert result.returncode == 0, result.stderr
    calls = [json.loads(line) for line in (root / "python-calls.jsonl").read_text().splitlines()]
    assert calls[0] == ["scripts/preflight.py", "--port", "8143", "--build"]
    assert calls[-1][-4:] == ["--ssl-certfile", env["VYUHA_SSL_CERTFILE"], "--ssl-keyfile", env["VYUHA_SSL_KEYFILE"]]
    assert json.loads((root / "npm-calls.jsonl").read_text()) == ["run", "build"]


def test_local_launcher_does_not_overwrite_incomplete_or_copied_venv(tmp_path):
    root = tmp_path / "incomplete officer"
    (root / "scripts").mkdir(parents=True)
    for name in ("python-runtime.sh", "start-local.sh"):
        shutil.copyfile(ROOT / "scripts" / name, root / "scripts" / name)
    (root / ".venv").mkdir()
    marker = root / ".venv" / "preserve.txt"
    marker.write_text("existing setup")
    result = subprocess.run(["bash", "scripts/start-local.sh"], cwd=root, capture_output=True, text=True, timeout=10)
    assert result.returncode == 1
    assert "recreated locally" in result.stderr
    assert marker.read_text() == "existing setup"


def _preflight(tmp_path, variables):
    # These configuration failures must occur before any socket bind or DB write.
    env = {**os.environ, "VYUHA_PORT": "8143", "VYUHA_DB": str(tmp_path / "test.db"), "VYUHA_SSL_CERTFILE": "", "VYUHA_SSL_KEYFILE": "", **variables}
    return subprocess.run([sys.executable, str(ROOT / "scripts/preflight.py")], env=env, capture_output=True, text=True, timeout=10)


def test_invalid_port_env_is_actionable_without_traceback(tmp_path):
    result = _preflight(tmp_path, {"VYUHA_PORT": "not-a-number"})
    assert result.returncode == 2
    assert "invalid int value" in result.stderr
    assert "Traceback" not in result.stderr


@pytest.mark.parametrize("name", ["VYUHA_SSL_CERTFILE", "VYUHA_SSL_KEYFILE"])
def test_preflight_rejects_partial_tls_configuration(tmp_path, name):
    result = _preflight(tmp_path, {name: str(tmp_path / "missing.pem")})
    assert result.returncode == 1
    assert "Set both" in result.stderr


@pytest.mark.parametrize("missing", ["certificate", "private key"])
def test_preflight_rejects_missing_tls_files_before_launch(tmp_path, missing):
    cert, key = tmp_path / "server.crt", tmp_path / "server.key"
    if missing != "certificate": cert.write_text("placeholder cert")
    if missing != "private key": key.write_text("placeholder key")
    result = _preflight(tmp_path, {"VYUHA_SSL_CERTFILE": str(cert), "VYUHA_SSL_KEYFILE": str(key)})
    assert result.returncode == 1
    assert f"TLS {missing} file is missing or unreadable" in result.stderr


def test_unit_cli_port_is_identical_in_preflight_and_uvicorn(tmp_path):
    root,env=_project(tmp_path,'Scripts/python.exe')
    for args in [['--port','9157'],['--port=9157']]:
        log=root/'python-calls.jsonl'
        if log.exists():log.unlink()
        result=subprocess.run(['bash','scripts/start-unit.sh',*args],cwd=root,env=env,capture_output=True,text=True,timeout=10)
        assert result.returncode==0,result.stderr
        calls=[json.loads(line) for line in log.read_text().splitlines()]
        assert calls[0]==['scripts/preflight.py',*args]
        assert calls[-1][-2:]==['--port','9157']
        assert 'http://10.23.4.5:9157' in result.stdout
