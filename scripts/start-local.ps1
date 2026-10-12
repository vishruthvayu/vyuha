[CmdletBinding()]
param([switch]$Setup)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$Python = Join-Path (Get-Location) '.venv/Scripts/python.exe'
if ($Setup -or -not (Test-Path $Python) -or -not (Test-Path 'client/dist/index.html')) {
    & (Join-Path $PSScriptRoot 'setup-officer.ps1')
}
if (-not (Test-Path $Python)) { throw 'Officer setup is missing. Run scripts/setup-officer.ps1 with internet.' }
& $Python scripts/preflight.py
if ($LASTEXITCODE -ne 0) { throw 'Startup preflight failed.' }
& $Python -c 'import fastapi, uvicorn'
if ($LASTEXITCODE -ne 0) { throw 'Officer dependencies missing. Run scripts/setup-officer.ps1 with internet.' }
$Port = if ($env:VYUHA_PORT) { $env:VYUHA_PORT } else { '8000' }
Write-Host "VYUHA local: http://127.0.0.1:$Port"
& $Python -m uvicorn server.main:app --host 127.0.0.1 --port $Port
exit $LASTEXITCODE
