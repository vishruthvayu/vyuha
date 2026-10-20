#!/usr/bin/env python3
"""Provision a local officer credential without placing a password in shell history."""
import getpass
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.auth import provision
if __name__=='__main__':
    first=getpass.getpass('Officer password (12+ characters): ')
    second=getpass.getpass('Confirm officer password: ')
    if first!=second:sys.exit('Passwords differ; no credential written')
    try:path=provision(first)
    except ValueError as e:sys.exit(str(e))
    print(f'Officer credential provisioned at {path}. Keep this file private; use trusted LAN HTTPS.')
