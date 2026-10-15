"""Actionable local startup checks; no downloads or database rewrites."""
import argparse, os, shutil, socket, sys
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--build',action='store_true');p.add_argument('--port',type=int,default=os.environ.get('VYUHA_PORT','8000'));a=p.parse_args()
def fail(message):print('VYUHA startup: '+message,file=sys.stderr);sys.exit(1)
if sys.version_info < (3,11):fail('Python 3.11 or newer is required. Install it and recreate .venv.')
if not 1<=a.port<=65535:fail('VYUHA_PORT must be between 1 and 65535.')
if a.build and not (shutil.which('node') and shutil.which('npm')):fail('Node.js and npm are required for the first installation/build. Install Node.js 20.19+ or 22.12+.')
if a.build:
 import subprocess
 version=subprocess.check_output(['node','--version'],text=True).strip().lstrip('v').split('.')
 major,minor=map(int,version[:2])
 if not (major==20 and minor>=19 or major==22 and minor>=12 or major>22):fail('Unsupported Node version. Use Node.js 20.19+ or 22.12+.')
cert=os.environ.get('VYUHA_SSL_CERTFILE','');key=os.environ.get('VYUHA_SSL_KEYFILE','')
if bool(cert)!=bool(key):fail('Set both VYUHA_SSL_CERTFILE and VYUHA_SSL_KEYFILE for HTTPS.')
for label,value in [('certificate',cert),('private key',key)]:
 if value and (not Path(value).is_file() or not os.access(value,os.R_OK)):fail(f'The configured TLS {label} file is missing or unreadable.')
try:
 # BSD/macOS can allow wildcard and specific-address listeners to coexist.
 # Include owned addresses so localhost/LAN cannot reach another service after
 # Unit Mode reports success. Enumeration reads local interfaces, never DNS.
 hosts=['127.0.0.1']
 if os.name=='posix':
  import runpy
  owned=runpy.run_path(str(Path(__file__).with_name('lan-addresses.py')))['addresses']
  hosts.extend(owned(include_nonprivate=True))
 hosts.append('0.0.0.0')
 for host in dict.fromkeys(hosts):
  with socket.socket() as s:
   # Match asyncio/Uvicorn on POSIX: closed browser connections in TIME_WAIT
   # must not prevent a restart. Never use SO_REUSEPORT.
   if os.name == 'posix':s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
   elif hasattr(socket,'SO_EXCLUSIVEADDRUSE'):s.setsockopt(socket.SOL_SOCKET,socket.SO_EXCLUSIVEADDRUSE,1)
   s.bind((host,a.port))
   s.listen(1) # Binding alone can succeed beside a reusable listener on some OSes.
except OSError as e:fail(f'Cannot open port {a.port}: {e}. Stop the existing server or set VYUHA_PORT to a free port.')
db=Path(os.environ.get('VYUHA_DB',Path(__file__).resolve().parents[1]/'data/vyuha.db'))
try:
 db.parent.mkdir(parents=True,exist_ok=True)
 if db.exists() and not db.is_file():raise PermissionError('database path is not a file')
 if db.exists() and not os.access(db,os.W_OK):raise PermissionError('database file is read-only')
 import tempfile
 with tempfile.TemporaryFile(dir=db.parent):pass
except OSError as e:fail(f'Database directory is inaccessible: {e}. Set VYUHA_DB to a writable local path.')
if not a.build and not (Path(__file__).resolve().parents[1]/'client/dist/index.html').exists():fail('Frontend assets missing. Run scripts/start-local.sh once with internet, or cd client && npm run build.')
