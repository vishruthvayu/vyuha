"""Frozen public training sites: rendered footprints are the modeled LOS boxes.

Original synthetic, metric layouts; not surveyed geography or operational sites.
No contact, identity or outcome enters a public site definition.
"""
import copy

VERSION = 'training-site-v1'
SITE_IDS = ('freight_corridor', 'open_campus')


def _structure(id, label, x0, x1, z0, z1, height, style):
    return dict(id=id, label=label, x_min=x0, x_max=x1, z_min=z0,
                z_max=z1, height=height, style=style)


_SITES = {
    'freight_corridor': dict(
        version=VERSION, id='freight_corridor', title='Freight corridor',
        summary='A long transfer hall separates the observation apron from the northern approach. Public site geometry, not a contact or future-evidence map.',
        structures=[
            _structure('transfer_hall', 'Transfer hall', -105, 105, 250, 325, 30, 'warehouse'),
            _structure('east_depot', 'East depot', 195, 275, 390, 505, 22, 'warehouse'),
            _structure('administration', 'Administration', -285, -220, 145, 220, 17, 'block'),
            _structure('south_stores', 'South stores', -175, -65, -245, -175, 15, 'warehouse'),
        ],
        surfaces=[
            dict(kind='asphalt', width=14, path=[[-600, 190], [0, 190], [600, 190]]),
            dict(kind='asphalt', width=12, path=[[145, -600], [145, 190], [145, 650]]),
            dict(kind='concrete', path=[[-115, 205], [115, 205], [115, 245], [-115, 245]]),
            dict(kind='concrete', path=[[-50, -45], [50, -45], [50, 90], [-50, 90]]),
            dict(kind='gravel', path=[[-330, 100], [-195, 100], [-195, 240], [-330, 240]]),
        ],
        landmarks=[
            dict(id='apron', label='Observation apron', position=dict(x=0, y=0, z=45)),
            dict(id='hall', label='Transfer hall', position=dict(x=0, y=30, z=287.5)),
            dict(id='junction', label='Service junction', position=dict(x=145, y=0, z=190)),
        ],
    ),
    'open_campus': dict(
        version=VERSION, id='open_campus', title='Open transfer campus',
        summary='Separated low buildings flank an open central approach. This contrasting public layout changes actual modeled sight lines, not sensor quality.',
        structures=[
            _structure('west_workshop', 'West workshop', -260, -165, 270, 345, 12, 'warehouse'),
            _structure('east_workshop', 'East workshop', 165, 260, 270, 345, 12, 'warehouse'),
            _structure('west_office', 'West office', -240, -175, -160, -90, 10, 'block'),
            _structure('east_store', 'East store', 190, 280, -190, -115, 14, 'warehouse'),
        ],
        surfaces=[
            dict(kind='asphalt', width=10, path=[[-550, 220], [0, 220], [550, 220]]),
            dict(kind='asphalt', width=10, path=[[0, -550], [0, 220], [0, 650]]),
            dict(kind='concrete', path=[[-70, -45], [70, -45], [70, 110], [-70, 110]]),
            dict(kind='concrete', path=[[-270, 230], [-155, 230], [-155, 265], [-270, 265]]),
            dict(kind='concrete', path=[[155, 230], [270, 230], [270, 265], [155, 265]]),
        ],
        landmarks=[
            dict(id='court', label='Central observation court', position=dict(x=0, y=0, z=65)),
            dict(id='workshops', label='Workshop crossing', position=dict(x=0, y=0, z=220)),
            dict(id='north_lane', label='Open north lane', position=dict(x=0, y=0, z=480)),
        ],
    ),
}


def training_site(site_id='freight_corridor'):
    if site_id not in SITE_IDS:
        raise ValueError('Unknown frozen training site')
    return copy.deepcopy(_SITES[site_id])


def terrain_boxes(site):
    return [{k: s[k] for k in ('x_min', 'x_max', 'z_min', 'z_max', 'height')}
            for s in site['structures']]


def validate_site(site):
    if type(site) is not dict or site != training_site(site.get('id')):
        raise ValueError('Training site disagrees with its complete frozen definition')
    return site


def site_catalog():
    return [dict(id=s['id'], title=s['title'], summary=s['summary'])
            for s in (training_site(id) for id in SITE_IDS)]
