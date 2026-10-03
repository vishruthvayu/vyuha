"""SQLite online backup and explicit restore into a new, disposable destination."""
import sqlite3,os
from pathlib import Path

def backup(source, destination):
 source,destination=Path(source).resolve(),Path(destination).resolve()
 if source==destination or destination.exists():raise ValueError('Backup destination must be a new file, different from source')
 if not source.is_file():raise ValueError('Source database does not exist')
 destination.parent.mkdir(parents=True,exist_ok=True)
 # Reserve the destination exclusively before SQLite opens it.
 fd=os.open(destination,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.close(fd)
 try:
  with sqlite3.connect(source.as_uri()+'?mode=ro',uri=True) as src,sqlite3.connect(destination) as dst:
   if src.execute('PRAGMA quick_check').fetchone()[0]!='ok':raise ValueError('Source database failed integrity check')
   src.backup(dst)
   if dst.execute('PRAGMA quick_check').fetchone()[0]!='ok':raise ValueError('Backup failed integrity check')
 except Exception:
  destination.unlink(missing_ok=True);raise
 return destination

def restore(source,destination):
 # Intentionally never overwrites a live database. Operator stops the server and
 # points VYUHA_DB at the restored file after validating it.
 return backup(source,destination)
