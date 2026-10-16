"""Read-only synthetic Analytics UI check. Run against Vite on port 5187.
No backend acceptance is implied: every /api/v1 response is an explicit fixture.
"""
import asyncio
import json
import re
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[3]
BASE = 'http://127.0.0.1:5187'
SKILLS = ['detection', 'classification_iff', 'effector_choice', 'degraded_sensor_response']
SESSIONS = [dict(id=name, title=f'Synthetic {name}', pack='SYNTHETIC QA ONLY', seed=i,
    observed_tick=300, score=50+i, nodes=dict(detect=10, classify=10, prioritise=10, engage=20+i),
    leakers=0, roe_breaches=0, failures={}) for i, name in enumerate(['first', 'second', 'third'])]
TRAINEES = [dict(unit_id='local', trainee_id=f'qa-{i}', callsign=f'Synthetic trainee {i}') for i in [1, 2]]
HISTORY = dict(prior={s: .5 for s in SKILLS}, points=[], sessions=SESSIONS,
    note='SYNTHETIC QA FIXTURE — browser interaction evidence only; no training efficacy claim.')

async def main():
    receipt = dict(scope='Actual application UI with intercepted, clearly labelled synthetic API fixtures',
        widths=[], non_read_requests=[], page_errors=[], axe=[], actions=[])
    before = json.dumps(HISTORY, sort_keys=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(executable_path='/home/naveen/.cache/ms-playwright/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
        page = await browser.new_page(viewport=dict(width=1440, height=1000), device_scale_factor=1)
        page.on('pageerror', lambda err: receipt['page_errors'].append(str(err)))
        async def respond(route):
            req = route.request
            if req.method != 'GET':
                receipt['non_read_requests'].append(dict(method=req.method, url=req.url))
                await route.abort()
                return
            path = req.url.split('/api/v1')[-1].split('?')[0]
            if path == '/auth/session': data = dict(authenticated=True, configured=True)
            elif path == '/health': data = dict(mode='standalone', status='ok')
            elif path == '/units': data = dict(units=[dict(id='local', name='SYNTHETIC QA · UI test only')])
            elif path == '/units/local/trainees': data = dict(trainees=TRAINEES)
            elif path.startswith('/trainees/'): data = HISTORY
            elif path == '/units/local/analytics': data = dict(points=[], note=HISTORY['note'])
            else:
                await route.fulfill(status=404, json=dict(detail='No synthetic fixture for this endpoint'))
                return
            await route.fulfill(json=data)
        await page.route('**/api/v1/**', respond)
        await page.add_init_script("localStorage.setItem('tour_completed','true')")
        link = BASE + '/analytics?source=synthetic-qa&unit=local&trainee=qa-2&sessionA=third&sessionB=first#session-comparison'
        await page.goto(link)
        await page.get_by_role('combobox', name=re.compile(r'^Session A(?:\s|$)')).wait_for()
        for width in [360, 390, 428, 768, 1024, 1280, 1440, 1920]:
            await page.set_viewport_size(dict(width=width, height=1000))
            await page.reload()
            await page.get_by_role('combobox', name=re.compile(r'^Session A(?:\s|$)')).wait_for()
            assert await page.get_by_role('combobox', name=re.compile(r'^Trainee(?:\s|$)')).input_value() == 'qa-2'
            assert await page.get_by_role('combobox', name=re.compile(r'^Session A(?:\s|$)')).input_value() == 'third'
            assert await page.get_by_role('combobox', name=re.compile(r'^Session B(?:\s|$)')).input_value() == 'first'
            overflow = await page.evaluate('document.documentElement.scrollWidth > innerWidth')
            assert not overflow, f'document overflow at {width}'
            table = await page.locator('.analytics-comparison-table').evaluate('(el) => ({width:el.getBoundingClientRect().width, container:el.parentElement.clientWidth, scroll:el.parentElement.scrollWidth})')
            if width <= 640:
                assert table['scroll'] <= table['container'] + 1, table
            await page.add_script_tag(path=str(ROOT / 'client/node_modules/axe-core/axe.min.js'))
            axe = await page.evaluate("async () => {const r = await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}); return {violations:r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length})),incomplete:r.incomplete.map(v=>v.id)}}")
            assert not axe['violations'], axe['violations']
            receipt['axe'].append(dict(width=width, **axe))
            receipt['widths'].append(dict(width=width, reload_restored=True, document_overflow=overflow, comparison_table=table))
            await page.screenshot(path=str(OUT / f'comparison-{width}.png'), full_page=True)
        await page.get_by_role('combobox', name=re.compile(r'^Session A(?:\s|$)')).select_option('second')
        assert 'sessionA=second' in page.url
        await page.go_back()
        await page.wait_for_function("document.querySelectorAll('select')[2]?.value === 'third'")
        await page.go_forward()
        await page.wait_for_function("document.querySelectorAll('select')[2]?.value === 'second'")
        receipt['actions'].append('Session comparison selection restored by browser Back/Forward')
        await page.get_by_role('combobox', name=re.compile(r'^Session A(?:\s|$)')).focus()
        await page.keyboard.press('Tab')
        assert await page.get_by_role('combobox', name=re.compile(r'^Session B(?:\s|$)')).evaluate('(el) => document.activeElement === el')
        receipt['actions'].append('Keyboard Tab moves from Session A to Session B')
        await page.get_by_role('combobox', name=re.compile(r'^Trainee(?:\s|$)')).select_option('qa-1')
        await page.wait_for_function("document.querySelectorAll('select')[2]?.value === 'second'")
        assert 'trainee=qa-1' in page.url
        await page.reload()
        await page.get_by_role('combobox', name=re.compile(r'^Session A(?:\s|$)')).wait_for()
        assert await page.get_by_role('combobox', name=re.compile(r'^Trainee(?:\s|$)')).input_value() == 'qa-1'
        receipt['actions'].append('Trainee selection restored after page reload')
        await page.goto(BASE + '/analytics?unit=local&trainee=missing#session-comparison')
        await page.get_by_text('The linked trainee is unavailable', exact=False).wait_for()
        await page.screenshot(path=str(OUT / 'unavailable-trainee-1920.png'), full_page=True)
        receipt['actions'].append('Unavailable linked trainee shows recovery rather than substituted evidence')
        assert before == json.dumps(HISTORY, sort_keys=True)
        assert not receipt['non_read_requests']
        assert not receipt['page_errors']
        receipt['fixture_unchanged'] = True
        (OUT / 'browser-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
        await browser.close()

asyncio.run(main())
