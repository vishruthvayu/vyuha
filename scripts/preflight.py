"""Actionable local startup checks; no downloads or database rewrites."""
import argparse, os, shutil, socket, sys
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--build',action='store_true');p.add_argument('--port',type=int,default=int(os.environ.get('VYUHA_PORT','8000')));a=p.parse_args()
def fail(message):print('VYUHA startup: '+message,file=sys.stderr);sys.exit(1)
if sys.version_info < (3,11):fail('Python 3.11 or newer is required. Install it and recreate .venv.')
if not 1<=a.port<=65535:fail('VYUHA_PORT must be between 1 and 65535.')
if a.build and not (shutil.which('node') and shutil.which('npm')):fail('Node.js and npm are required for the first installation/build. Install Node.js 20.19+ or 22.12+.')
if a.build:
 import subprocess
 version=subprocess.check_output(['node','--version'],text=True).strip().lstrip('v').split('.')
 major,minor=map(int,version[:2])
 if not (major==20 and minor>=19 or major==22 and minor>=12 or major>22):fail('Unsupported Node version. Use Node.js 20.19+ or 22.12+.')
try:
 with socket.socket() as s:s.bind(('0.0.0.0',a.port))
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
