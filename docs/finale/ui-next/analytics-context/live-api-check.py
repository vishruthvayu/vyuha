"""Production UI + real isolated API acceptance. No request interception.
Requires /var/tmp/vyuha-hardening-qa-current's synthetic server on port 8017.
Credentials are read locally and never included in receipts.
"""
import asyncio
import hashlib
import json
import re
from pathlib import Path
import httpx
from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[3]
QA = Path('/var/tmp/vyuha-hardening-qa-current')
BASE = 'http://127.0.0.1:8017'

async def main():
    token = (QA / 'token').read_text()
    rows = json.loads((QA / 'sessions.json').read_text())
    trainee = rows[0]['identity']['trainee_id']
    ids = rows[0]['sessions']
    http = httpx.Client(base_url=BASE+'/api/v1', headers={'Authorization': 'Bearer '+token})
    def snapshot():
        result = {}
        for row in rows:
            path = '/trainees/'+row['identity']['trainee_id']+'/analytics'
            response = http.get(path); response.raise_for_status()
            result[path] = hashlib.sha256(json.dumps(response.json(), sort_keys=True).encode()).hexdigest()
            for sid in row['sessions']:
                path = '/sessions/'+sid+'/aar'
                response = http.get(path); response.raise_for_status()
                result[path] = hashlib.sha256(json.dumps(response.json(), sort_keys=True).encode()).hexdigest()
        return result
    before = snapshot()
    receipt = dict(scope='Production assets served by real API; five isolated synthetic no-action sessions, no intercepted requests',
        widths=[], non_read_requests=[], page_errors=[], axe=[], evidence_hashes_before=before)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(executable_path='/home/naveen/.cache/ms-playwright/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
        page = await browser.new_page(viewport=dict(width=1440, height=1000), device_scale_factor=1, service_workers='block')
        page.on('pageerror', lambda err: receipt['page_errors'].append(str(err)))
        page.on('request', lambda req: receipt['non_read_requests'].append({'method': req.method, 'path':req.url.split('/api/v1')[-1]}) if '/api/v1' in req.url and req.method != 'GET' else None)
        await page.add_init_script('sessionStorage.setItem("vyuha-officer-session", '+json.dumps(token)+'); localStorage.setItem("tour_completed","true")')
        link = BASE+'/analytics?source=synthetic-live-qa&unit=local&trainee='+trainee+'&sessionA='+ids[2]+'&sessionB='+ids[0]+'#session-comparison'
        await page.goto(link)
        a = page.get_by_role('combobox', name=re.compile(r'^Session A(?:\s|$)'))
        b = page.get_by_role('combobox', name=re.compile(r'^Session B(?:\s|$)'))
        for width in [360, 390, 428, 768, 1024, 1280, 1440, 1920]:
            await page.set_viewport_size(dict(width=width, height=1000))
            await page.reload()
            await a.wait_for()
            assert await a.input_value() == ids[2]
            assert await b.input_value() == ids[0]
            assert not await page.evaluate('document.documentElement.scrollWidth > innerWidth')
            geometry = await page.locator('.analytics-comparison-table').evaluate('(el) => ({width:el.getBoundingClientRect().width, container:el.parentElement.clientWidth, scroll:el.parentElement.scrollWidth})')
            if width <= 640: assert geometry['scroll'] <= geometry['container'] + 1
            await page.add_script_tag(path=str(ROOT/'client/node_modules/axe-core/axe.min.js'))
            axe = await page.evaluate("async () => {const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return {violations:r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length})),incomplete:r.incomplete.map(v=>v.id)}}")
            assert not axe['violations'], axe['violations']
            receipt['axe'].append(dict(width=width, **axe))
            receipt['widths'].append(dict(width=width, restored=True, comparison_table=geometry))
            await page.screenshot(path=str(OUT/f'live-comparison-{width}.png'), full_page=True)
        await a.select_option(ids[1])
        await page.go_back()
        await page.wait_for_function('(id) => document.querySelectorAll("select")[2]?.value === id', arg=ids[2])
        await page.go_forward()
        await page.wait_for_function('(id) => document.querySelectorAll("select")[2]?.value === id', arg=ids[1])
        await page.reload(); await a.wait_for()
        assert await a.input_value() == ids[1]
        await a.focus(); await page.keyboard.press('Tab')
        assert await b.evaluate('(el) => document.activeElement === el')
        receipt['history_reload_and_keyboard'] = 'PASS'
        await browser.close()
    after = snapshot()
    assert before == after
    assert not receipt['non_read_requests']
    assert not receipt['page_errors']
    receipt['evidence_hashes_after'] = after
    receipt['evidence_unchanged'] = True
    (OUT/'live-api-receipt.json').write_text(json.dumps(receipt, indent=2)+'\n')
    http.close()

asyncio.run(main())
