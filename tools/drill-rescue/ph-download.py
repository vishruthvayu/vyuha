# Download Poly Haven CC0 assets (outside the repository). Each asset gets its own directory.
import json, os, sys, urllib.request
BASE = os.environ.get('ASSETS_SRC', os.path.expanduser('~/vyuha-drill-rescue-work/assets-src'))
UA = {'User-Agent': 'vyuha-research/1.0 (asset ledger)'}
def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()
def save(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'wb').write(data)
ledger = []
def record(kind, aid, files):
    info = json.loads(get(f'https://api.polyhaven.com/info/{aid}'))
    ledger.append(dict(kind=kind, id=aid, url=f'https://polyhaven.com/a/{aid}', name=info.get('name'), authors=list(info.get('authors', {}).keys()), license='CC0 1.0 (Poly Haven)', polycount=info.get('polycount'), dimensions_mm=info.get('dimensions'), files=files))
def hdri(aid, res):
    f = json.loads(get(f'https://api.polyhaven.com/files/{aid}'))
    u = f['hdri'][res]['hdr']; p = f'{BASE}/hdri-{aid}/{aid}_{res}.hdr'
    if not os.path.exists(p): save(p, get(u['url']))
    record('hdri', aid, [dict(file=os.path.basename(p), bytes=u['size'], md5=u.get('md5'))])
def texture(aid, res, maps=('Diffuse', 'nor_gl', 'Rough', 'AO', 'arm')):
    f = json.loads(get(f'https://api.polyhaven.com/files/{aid}'))
    out = []
    for m in maps:
        if m not in f: continue
        e = f[m][res].get('jpg') or f[m][res].get('png')
        p = f'{BASE}/tex-{aid}/{aid}_{m}_{res}.{e["url"].rsplit(".",1)[1]}'
        if not os.path.exists(p): save(p, get(e['url']))
        out.append(dict(file=os.path.basename(p), bytes=e['size'], md5=e.get('md5')))
    record('texture', aid, out)
def model(aid, res):
    f = json.loads(get(f'https://api.polyhaven.com/files/{aid}'))
    g = f['gltf'][res]['gltf']; d = f'{BASE}/model-{aid}'
    out = [dict(file=os.path.basename(g['url']), bytes=g['size'], md5=g.get('md5'))]
    if not os.path.exists(f'{d}/{os.path.basename(g["url"])}'): save(f'{d}/{os.path.basename(g["url"])}', get(g['url']))
    for rel, inc in g.get('include', {}).items():
        p = os.path.normpath(f'{d}/{rel}')
        assert p.startswith(d + '/'), 'path escape'
        if not os.path.exists(p): save(p, get(inc['url']))
        out.append(dict(file=rel, bytes=inc['size'], md5=inc.get('md5')))
    record('model', aid, out)
spec = json.load(open(sys.argv[1]))
for aid, res in spec.get('hdri', []): hdri(aid, res); print('hdri', aid)
for aid, res in spec.get('texture', []): texture(aid, res); print('texture', aid)
for aid, res in spec.get('model', []): model(aid, res); print('model', aid)
json.dump(ledger, open(f'{BASE}/ledger-{os.path.basename(sys.argv[1])}', 'w'), indent=1)
