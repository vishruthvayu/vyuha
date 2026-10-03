#!/usr/bin/env python3
"""Create a private local shared key. Never prints or commits its bytes."""
import argparse,os
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('path',type=Path);a=p.parse_args();a.path.parent.mkdir(parents=True,exist_ok=True)
with os.fdopen(os.open(a.path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'wb') as f:f.write(os.urandom(32))
print('Key created at',a.path,'Keep it private; configure VYUHA_BUNDLE_KEYFILE and share through a trusted offline channel.')
