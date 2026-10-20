# No downloads. Prepare dependencies with setup-officer.ps1 once while online.
[CmdletBinding()]
param([switch]$Build)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$Python = Join-Path (Get-Location) '.venv/Scripts/python.exe'
if (-not (Test-Path $Python)) { throw 'Officer setup is missing. Run scripts/setup-officer.ps1 once with internet.' }
$Preflight = @('scripts/preflight.py')
if ($Build) { $Preflight += '--build' }
& $Python @Preflight
if ($LASTEXITCODE -ne 0) { throw 'Startup preflight failed.' }
& $Python -c 'import fastapi, uvicorn'
if ($LASTEXITCODE -ne 0) { throw 'Officer dependencies missing. Run scripts/setup-officer.ps1 once with internet.' }
if ($Build) {
    $Npm = (Get-Command npm.cmd -ErrorAction Stop).Source
    Push-Location client
    try { & $Npm run build; if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' } } finally { Pop-Location }
}
if (-not (Test-Path 'client/dist/index.html')) { throw 'Frontend assets missing. Run scripts/setup-officer.ps1 once with internet.' }
$Port = if ($env:VYUHA_PORT) { $env:VYUHA_PORT } else { '8000' }
$Protocol = 'http'
$Arguments = @('-m', 'uvicorn', 'server.main:app', '--no-access-log', '--host', '0.0.0.0', '--port', $Port)
if ($env:VYUHA_SSL_CERTFILE -or $env:VYUHA_SSL_KEYFILE) {
    if (-not $env:VYUHA_SSL_CERTFILE -or -not $env:VYUHA_SSL_KEYFILE) { throw 'Set both VYUHA_SSL_CERTFILE and VYUHA_SSL_KEYFILE.' }
    if (-not (Test-Path $env:VYUHA_SSL_CERTFILE) -or -not (Test-Path $env:VYUHA_SSL_KEYFILE)) { throw 'The configured certificate/key files are missing.' }
    $Protocol = 'https'
    $Arguments += @('--ssl-certfile', $env:VYUHA_SSL_CERTFILE, '--ssl-keyfile', $env:VYUHA_SSL_KEYFILE)
}
$env:VYUHA_UNIT_MODE = '1'
Write-Host "VYUHA Unit Mode: ${Protocol}://127.0.0.1:$Port"
Write-Host "Officer console: ${Protocol}://127.0.0.1:$Port/instructor"
$Addresses = @()
if (Get-Command Get-NetIPAddress -ErrorAction SilentlyContinue) {
    $Addresses = @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.AddressState -eq 'Preferred' } | Select-Object -ExpandProperty IPAddress -Unique)
}
if (-not $Addresses) { $Addresses = @(& $Python scripts/lan-addresses.py) }
foreach ($Address in $Addresses) { Write-Host "Candidate trainee URL: ${Protocol}://${Address}:$Port" }
Write-Host 'Choose the Wi-Fi/Ethernet address reachable from trainee devices. Permit the chosen server port on the private LAN only.'
Write-Host 'Assets and services are hosted locally; training has no required cloud service.'
Write-Host 'Plain HTTP supports LAN training and IndexedDB recovery. Service-worker reload requires browser-trusted HTTPS.'
Write-Host 'Use an isolated, trusted unit LAN; do not expose this prototype to the public internet.'
& $Python @Arguments
exit $LASTEXITCODE
