#!/usr/bin/env python3
"""Render the self-contained beginner guide to a PDF with local Chromium; no network required."""
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--output',type=Path,default=ROOT/'docs/vr/VYUHA-VR-GUIDE.pdf')
args=p.parse_args();args.output.parent.mkdir(parents=True,exist_ok=True)
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
 page=browser.new_page()
 page.goto((ROOT/'client/public/vr-guide.html').as_uri())
 page.pdf(path=str(args.output),format='A4',print_background=True,display_header_footer=True,header_template='<span></span>',footer_template='<div style="width:100%;font:9px sans-serif;color:#456370;text-align:center">VYUHA VR · beginner guide · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',prefer_css_page_size=True)
 browser.close()
print(args.output)
