"""Optional TLS provisioning: no system trust installation or private source data."""
import os,shutil,subprocess,sys
from pathlib import Path
import pytest

SCRIPT=Path(__file__).resolve().parents[2]/'scripts/make-cert.py'

@pytest.mark.skipif(not shutil.which('openssl'),reason='Optional local certificate generator requires OpenSSL')
def test_local_ca_san_key_permissions_and_no_overwrite(tmp_path):
 out=tmp_path/'certs'
 r=subprocess.run([sys.executable,str(SCRIPT),'--out',str(out),'--ip','192.168.1.17','--dns','officer.local'],capture_output=True,text=True)
 assert r.returncode==0,r.stderr
 assert 'No system trust store was changed' in r.stdout
 for host,args in [('192.168.1.17',['-verify_ip','192.168.1.17']),('officer.local',['-verify_hostname','officer.local'])]:
  verify=subprocess.run(['openssl','verify','-CAfile',str(out/'ca.crt'),*args,str(out/'server.crt')],capture_output=True,text=True)
  assert verify.returncode==0,verify.stderr
 wrong=subprocess.run(['openssl','verify','-CAfile',str(out/'ca.crt'),'-verify_ip','192.168.1.18',str(out/'server.crt')],capture_output=True,text=True)
 assert wrong.returncode!=0
 before=(out/'server.key').read_bytes()
 retry=subprocess.run([sys.executable,str(SCRIPT),'--out',str(out),'--ip','192.168.1.17'],capture_output=True,text=True)
 assert retry.returncode!=0 and (out/'server.key').read_bytes()==before
 if os.name!='nt':
  assert out.stat().st_mode&0o777==0o700
  assert (out/'server.key').stat().st_mode&0o777==0o600
  assert (out/'ca.key').stat().st_mode&0o777==0o600


def test_certificate_generator_requires_lan_san_and_rejects_invalid_hostname(tmp_path):
 for args in [[],['--dns','bad/host'],['--ip','not-an-ip']]:
  r=subprocess.run([sys.executable,str(SCRIPT),'--out',str(tmp_path/'unused'),*args],capture_output=True,text=True)
  assert r.returncode!=0
 assert not (tmp_path/'unused').exists()
