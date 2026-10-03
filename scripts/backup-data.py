#!/usr/bin/env python3
import argparse,sys,sqlite3
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.durability import backup,restore
from server.storage import DB_PATH
p=argparse.ArgumentParser(description='SQLite-safe backup, or restore into a NEW database file. Never overwrites a live database.');p.add_argument('operation',choices=['backup','restore']);p.add_argument('destination',type=Path);p.add_argument('--source',type=Path,default=DB_PATH);a=p.parse_args()
try:print((backup if a.operation=='backup' else restore)(a.source,a.destination))
except (ValueError,OSError,sqlite3.Error) as e:p.exit(1,str(e)+'\n')
