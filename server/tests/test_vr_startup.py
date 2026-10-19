"""VR launch is a strict TLS wrapper over the current Unit Mode launcher."""
import os
import subprocess
from pathlib import Path
import pytest

ROOT=Path(__file__).resolve().parents[2]

@pytest.mark.parametrize('configuration', ['absent','partial','missing'])
def test_vr_requires_readable_tls_configuration_without_starting(configuration,tmp_path):
    env={**os.environ,'VYUHA_SSL_CERTFILE':'','VYUHA_SSL_KEYFILE':''}
    if configuration=='partial':env['VYUHA_SSL_CERTFILE']=str(tmp_path/'cert.pem')
    if configuration=='missing':env.update(VYUHA_SSL_CERTFILE=str(tmp_path/'cert.pem'),VYUHA_SSL_KEYFILE=str(tmp_path/'key.pem'))
    result=subprocess.run(['bash',str(ROOT/'scripts/start-vr.sh')],env=env,capture_output=True,text=True,timeout=10)
    assert result.returncode==2
    assert 'trusted HTTPS' in result.stderr or 'not readable' in result.stderr
    assert 'private key' not in result.stdout

def test_vr_delegates_current_unit_launcher_and_preserves_quoted_arguments(tmp_path):
    scripts=tmp_path/'project with spaces'/'scripts';scripts.mkdir(parents=True)
    (scripts/'start-vr.sh').write_bytes((ROOT/'scripts/start-vr.sh').read_bytes())
    (scripts/'start-unit.sh').write_text('#!/usr/bin/env bash\nprintf "%s\\n" "$@"\n')
    cert=tmp_path/'server cert.pem';key=tmp_path/'private key.pem';cert.write_text('fixture');key.write_text('fixture')
    result=subprocess.run(['bash',str(scripts/'start-vr.sh'),'--port','8123','--build'],env={**os.environ,'VYUHA_SSL_CERTFILE':str(cert),'VYUHA_SSL_KEYFILE':str(key)},capture_output=True,text=True,timeout=10)
    assert result.returncode==0
    assert result.stdout.splitlines()==['--port','8123','--build']
