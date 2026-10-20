#!/usr/bin/env python3
"""Generate a local CA and SAN server certificate; never installs browser trust.

Keep private keys on the officer. Share only ca.crt for explicit device trust.
"""
import argparse
import ipaddress
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path


def find_openssl(explicit=None, *, windows=None, environ=None):
    """Resolve an approved override, PATH, then known Git for Windows layouts.

    An invalid explicit override must fail rather than silently use another tool.
    No downloads, registry writes, recursive disk scans or shell execution occur.
    """
    if explicit is not None:
        return shutil.which(explicit)
    executable = shutil.which('openssl')
    if executable:
        return executable
    if windows is None:
        windows = os.name == 'nt'
    if not windows:
        return None
    env = os.environ if environ is None else environ
    roots = []
    git = shutil.which('git')
    if git:
        # cmd/git.exe, bin/git.exe, mingw64/bin/git.exe and portable installs.
        roots.extend(list(Path(git).parents)[:3])
    for name in ('ProgramW6432', 'ProgramFiles', 'ProgramFiles(x86)'):
        if env.get(name):
            roots.append(Path(env[name]) / 'Git')
    if env.get('LOCALAPPDATA'):
        roots.append(Path(env['LOCALAPPDATA']) / 'Programs' / 'Git')
    seen = set()
    for root in roots:
        candidate = root / 'usr' / 'bin' / 'openssl.exe'
        if str(candidate) not in seen:
            seen.add(str(candidate))
            if candidate.is_file():
                return str(candidate)
    return None


def trust_guidance(out, fingerprint):
    print('CA SHA-256 fingerprint:', fingerprint)
    print('Compare this fingerprint on the receiving device before trusting ca.crt.')
    print('Windows: open certmgr.msc, then Current User > Trusted Root Certification Authorities > Certificates > All Tasks > Import; select only ca.crt. Follow your administrator policy.')
    print('Android: Settings > Security & privacy > More security settings > Encryption & credentials > Install a certificate > CA certificate; select only ca.crt. Names vary by device.')
    print('Android instructions: https://support.google.com/pixelphone/answer/2844832')
    print('Never share ca.key or server.key; never commit either key. Restrict the Windows certificate directory ACL to the officer and administrators.')
    print('Set VYUHA_SSL_CERTFILE to', out / 'server.crt', 'and VYUHA_SSL_KEYFILE to', out / 'server.key')
    print('Open HTTPS using the exact IP/hostname included in this certificate. Require a normal trusted connection; do not bypass certificate errors.')
    print('No system trust store was changed. Renew the server certificate before its 90-day expiry.')


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--out', type=Path, default=Path('data/certs'))
    p.add_argument('--ip', action='append', default=[], help='Officer LAN IPv4/IPv6 address; repeat for multiple addresses')
    p.add_argument('--dns', action='append', default=[], help='Optional LAN hostname; repeat as needed')
    p.add_argument('--openssl', help='Explicit OpenSSL executable path; otherwise PATH and Git for Windows are checked')
    a = p.parse_args()
    if not a.ip and not a.dns:
        p.error('Provide the officer LAN address with --ip or a hostname with --dns; localhost alone does not validate LAN TLS.')
    ips = [str(ipaddress.ip_address(v)) for v in a.ip]
    for host in a.dns:
        if not re.fullmatch(r'(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?', host) or '..' in host:
            p.error('Invalid DNS hostname')
    executable = find_openssl(a.openssl)
    if not executable:
        p.error('OpenSSL executable not found. Install OpenSSL or Git for Windows during online preparation, or pass --openssl "C:\\Program Files\\Git\\usr\\bin\\openssl.exe". An explicit invalid override is never replaced. No trust is installed automatically.')
    if a.out.exists() and any(a.out.iterdir()):
        p.error('Certificate output must be empty; existing keys are never overwritten.')
    a.out.mkdir(parents=True, exist_ok=True, mode=0o700)
    if os.name != 'nt':
        a.out.chmod(0o700)
    out = a.out.resolve()
    san = ['DNS:localhost', 'IP:127.0.0.1'] + [f'IP:{v}' for v in ips] + [f'DNS:{v}' for v in a.dns]
    with tempfile.TemporaryDirectory() as temp:
        extensions = Path(temp) / 'server.ext'
        extensions.write_text('basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=' + ','.join(dict.fromkeys(san)) + '\n')

        def run(*args):
            return subprocess.run([executable, *map(str, args)], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

        run('req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-sha256', '-days', '365', '-subj', '/CN=VYUHA Local Unit CA', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-keyout', out / 'ca.key', '-out', out / 'ca.crt')
        run('req', '-new', '-newkey', 'rsa:3072', '-nodes', '-sha256', '-subj', '/CN=VYUHA Local Unit Server', '-keyout', out / 'server.key', '-out', out / 'server.csr')
        run('x509', '-req', '-sha256', '-days', '90', '-in', out / 'server.csr', '-CA', out / 'ca.crt', '-CAkey', out / 'ca.key', '-CAcreateserial', '-extfile', extensions, '-out', out / 'server.crt')
        fingerprint = run('x509', '-in', out / 'ca.crt', '-noout', '-sha256', '-fingerprint').stdout.strip()
    if os.name != 'nt':
        for name in ('ca.key', 'server.key'):
            (out / name).chmod(0o600)
    print('Certificates generated at', out)
    print('OpenSSL executable:', executable)
    trust_guidance(out, fingerprint)


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as e:
        raise SystemExit('Certificate generation failed: ' + str(e))
