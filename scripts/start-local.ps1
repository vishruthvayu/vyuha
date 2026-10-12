[CmdletBinding()]
param([switch]$Setup, [ValidateRange(1,65535)][int]$Port = $(if ($env:VYUHA_PORT) { [int]$env:VYUHA_PORT } else { 8000 }))
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
# Pass the resolved port through setup preflight as well as the runtime launcher.
$env:VYUHA_PORT = [string]$Port
$Python = Join-Path (Get-Location) '.venv/Scripts/python.exe'
if ($Setup -or -not (Test-Path $Python) -or -not (Test-Path 'client/dist/index.html')) {
    & (Join-Path $PSScriptRoot 'setup-officer.ps1')
}
if (-not (Test-Path $Python)) { throw 'Officer setup is missing. Run scripts/setup-officer.ps1 with internet.' }
& $Python scripts/preflight.py
if ($LASTEXITCODE -ne 0) { throw 'Startup preflight failed.' }
& $Python -c 'import fastapi, uvicorn'
if ($LASTEXITCODE -ne 0) { throw 'Officer dependencies missing. Run scripts/setup-officer.ps1 with internet.' }
Write-Host "VYUHA local: http://127.0.0.1:$Port"
& $Python -m uvicorn server.main:app --host 127.0.0.1 --port $Port
exit $LASTEXITCODE
