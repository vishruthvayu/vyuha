import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
/** Backend parity subprocesses resolve from the repository root, on every OS.
 * Set VYUHA_TEST_PYTHON to an explicit Python 3.11+ executable when using a
 * nonstandard environment. Never disable parity because Python is missing.
 */
export function testPython(){
 const explicit=process.env.VYUHA_TEST_PYTHON;
 if(explicit)return explicit;
 const root=resolve(import.meta.dirname,'../..');
 const candidate=resolve(root,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
 if(existsSync(candidate))return candidate;
 throw new Error('Backend parity requires a prepared Python environment. Run the officer setup first, or set VYUHA_TEST_PYTHON to Python 3.11+ with server dependencies installed.');
}
