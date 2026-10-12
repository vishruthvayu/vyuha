#!/usr/bin/env python3
"""Optional technical reliability plots/CSV from a scoped evaluation report."""
import argparse,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.research_plots import render
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--report',type=Path,required=True);p.add_argument('--output-directory',type=Path,required=True);a=p.parse_args()
try:print(json.dumps(render(a.report,a.output_directory)))
except (ValueError,OSError,KeyError,TypeError) as e:p.exit(2,'REJECTED: '+str(e)+'\n')
