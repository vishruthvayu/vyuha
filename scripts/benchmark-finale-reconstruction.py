#!/usr/bin/env python3
"""Paired uncached reconstruction benchmark. Disposable DB and loopback server."""
import argparse
import cProfile
import hashlib
import json
import os
import platform
import pstats
import socket
import statistics
import subprocess
import sys
import tempfile
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


def encoded(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


def digest(value):
    return hashlib.sha256(encoded(value)).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--baseline', type=Path)
    parser.add_argument('--runs', type=int, default=3)
    args = parser.parse_args()
    if not 1 <= args.runs <= 20:
        parser.error('--runs must be between 1 and 20')
    args.root = args.root.resolve()
    sys.path.insert(0, str(args.root))
    args.output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='vyuha-reconstruction-paired-') as disposable:
        os.environ['VYUHA_DB'] = str(Path(disposable) / 'session.db')
        from server import storage
        from server.raid_v2 import compose_raid
        from server.review import build_review
        storage.init()
        with socket.socket() as port_socket:
            port_socket.bind(('127.0.0.1', 0))
            port = port_socket.getsockname()[1]
        with (args.output / 'http-server.log').open('w') as log:
            process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'server.main:app', '--host', '127.0.0.1', '--port', str(port)], cwd=args.root, env=os.environ.copy(), stdout=log, stderr=log)
            try:
                origin = f'http://127.0.0.1:{port}'
                for _ in range(100):
                    try:
                        urllib.request.urlopen(origin + '/api/v1/health', timeout=1).close()
                        break
                    except OSError:
                        time.sleep(.1)
                else:
                    raise RuntimeError('Disposable loopback service did not start')
                rows = []
                for n in (8, 25, 50, 100, 200):
                    spec = compose_raid({'seed': 482913, 'duration': 60, 'terrain': 'rural', 'family': 'DIRECT', 'difficulty': 'challenging', 'mix': ['hostile_quad', 'no_rf_fpv', 'fixed_wing'] + ['bird'] * (n-3)})
                    sid = f'paired-{n}'
                    direct, http = [], []
                    expected = None
                    for repeat in range(args.runs):
                        started = time.perf_counter()
                        review, card = build_review(spec, [], [], sid, 1800, 'completion', 1800)
                        direct.append(time.perf_counter() - started)
                        result = {'review': review, 'card': card}
                        assert expected is None or result == expected, 'Direct runs disagree'
                        expected = result
                        if repeat == 0:
                            if args.baseline:
                                assert expected == json.loads((args.baseline / f'snapshot-{n}.json').read_text()), 'Optimization changed complete review/card'
                            with storage.connect() as db:
                                db.execute('INSERT INTO scenarios(id,spec) VALUES (?,?)', (spec['id'], storage.dumps(spec)))
                                db.execute("INSERT INTO sessions(id,trainee,scenario_id,created_at,status,scorecard,end_tick,execution_tick,unit_id) VALUES (?,?,?,'synthetic-benchmark','completed',?,1800,1800,'local')", (sid, 'SYNTHETIC-PERFORMANCE', spec['id'], storage.dumps(card)))
                        started = time.perf_counter()
                        with urllib.request.urlopen(origin + f'/api/v1/sessions/{sid}/aar', timeout=120) as response:
                            aar = json.load(response)
                        http.append(time.perf_counter() - started)
                        assert aar['scorecard'] == card and all(aar[key] == value for key, value in review.items()), 'HTTP reconstruction differs'
                    (args.output / f'snapshot-{n}.json').write_bytes(encoded(expected))
                    row = {'contacts': n, 'duration_seconds': 60, 'observed_tick': 1800, 'scoring_tick': 1800, 'direct_seconds': direct, 'http_seconds': http, 'direct_median_seconds': statistics.median(direct), 'http_median_seconds': statistics.median(http), 'full_review_card_sha256': digest(expected), 'all_repeats_and_http_equal': True, 'matches_baseline': True if args.baseline else None}
                    rows.append(row)
                    print(json.dumps(row), flush=True)
                profiler = cProfile.Profile()
                profiler.enable()
                profiled = build_review(spec, [], [], sid, 1800, 'completion', 1800)
                profiler.disable()
                assert {'review': profiled[0], 'card': profiled[1]} == expected
                profiler.dump_stats(str(args.output / 'reconstruction-200.prof'))
                prof = pstats.Stats(profiler)
                hottest = sorted(prof.stats.items(), key=lambda item: item[1][3], reverse=True)[:20]
                profile_rows = [{'file': Path(key[0]).name, 'line': key[1], 'function': key[2], 'primitive_calls': value[0], 'total_calls': value[1], 'self_seconds': value[2], 'cumulative_seconds': value[3]} for key, value in hottest]
                report = {'schema_version': 1, 'measured_at_utc': datetime.now(timezone.utc).isoformat(), 'code_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=args.root, text=True).strip(), 'sensor_source_sha256': hashlib.sha256((args.root / 'server/sensors_v2.py').read_bytes()).hexdigest(), 'environment': {'os': platform.system(), 'python': platform.python_version(), 'machine': platform.machine()}, 'method': f'{args.runs} alternating direct build_review and actual loopback HTTP GET AAR samples for each frozen scenario. Synthetic three hostile contacts plus birds, no actions/commands, full observed 60-second horizon. Separate cProfile run at 200 contacts. Disposable SQLite only; no user database or physical network validation.', 'limitations': ['Software loopback HTTP on this workstation; no separate physical client.', 'Shared workstation activity may affect runtime. cProfile instrumentation is not unprofiled latency.', 'Scenario contact count changes the fixed synthetic bird roster; this does not measure human learning or operational calibration.'], 'scale': rows, 'profile': {'instrumented_seconds': prof.total_tt, 'total_calls': prof.total_calls, 'primitive_calls': prof.prim_calls, 'hot_functions': profile_rows}}
                (args.output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
            finally:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=10)


if __name__ == '__main__':
    main()
