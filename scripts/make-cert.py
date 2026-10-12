#!/usr/bin/env python3
"""Generate a local CA and SAN server certificate; never installs browser trust.

Default output is under ignored data/. Keep CA and server private keys on the
 officer only. Share only ca.crt for explicit manual trust on trainee devices.
"""
import argparse,ipaddress,os,re,shutil,subprocess,tempfile
from pathlib import Path


def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--out',type=Path,default=Path('data/certs'))
 p.add_argument('--ip',action='append',default=[],help='Officer LAN IPv4/IPv6 address; repeat for multiple addresses')
 p.add_argument('--dns',action='append',default=[],help='Optional LAN hostname; repeat as needed')
 p.add_argument('--openssl',default='openssl',help='OpenSSL executable path')
 a=p.parse_args()
 if not a.ip and not a.dns:p.error('Provide the officer LAN address with --ip or a hostname with --dns; localhost alone does not validate LAN TLS.')
 ips=[str(ipaddress.ip_address(v)) for v in a.ip]
 for host in a.dns:
  if not re.fullmatch(r'(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?',host) or '..' in host:p.error('Invalid DNS hostname')
 executable=shutil.which(a.openssl)
 if not executable:p.error('OpenSSL is required for certificate generation. Install it during online preparation or pass --openssl; no trust is installed automatically.')
 if a.out.exists() and any(a.out.iterdir()):p.error('Certificate output must be empty; existing keys are never overwritten.')
 a.out.mkdir(parents=True,exist_ok=True,mode=0o700)
 if os.name!='nt':a.out.chmod(0o700)
 out=a.out.resolve()
 san=['DNS:localhost','IP:127.0.0.1']+[f'IP:{v}' for v in ips]+[f'DNS:{v}' for v in a.dns]
 with tempfile.TemporaryDirectory() as temp:
  extensions=Path(temp)/'server.ext'
  extensions.write_text('basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName='+','.join(dict.fromkeys(san))+'\n')
  def run(*args):
   subprocess.run([executable,*map(str,args)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
  run('req','-x509','-newkey','rsa:3072','-nodes','-sha256','-days','365','-subj','/CN=VYUHA Local Unit CA','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign','-keyout',out/'ca.key','-out',out/'ca.crt')
  run('req','-new','-newkey','rsa:3072','-nodes','-sha256','-subj','/CN=VYUHA Local Unit Server','-keyout',out/'server.key','-out',out/'server.csr')
  run('x509','-req','-sha256','-days','90','-in',out/'server.csr','-CA',out/'ca.crt','-CAkey',out/'ca.key','-CAcreateserial','-extfile',extensions,'-out',out/'server.crt')
 if os.name!='nt':
  for name in ['ca.key','server.key']: (out/name).chmod(0o600)
 print('Certificates generated at',out)
 print('Manually trust ca.crt on authorized devices. Never share ca.key or server.key; never commit either key.')
 print('Set VYUHA_SSL_CERTFILE to server.crt and VYUHA_SSL_KEYFILE to server.key. Use the exact IP/hostname included in this certificate.')
 print('No system trust store was changed. Renew the server certificate before its 90-day expiry.')


if __name__=='__main__':
 try:main()
 except (OSError,ValueError,subprocess.CalledProcessError) as e:raise SystemExit('Certificate generation failed: '+str(e))
