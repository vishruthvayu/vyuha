# One-time online officer setup. Runtime launch performs no installation.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$PythonCommand = $null
$PythonPrefix = @()
foreach ($Name in @('python', 'python3', 'py')) {
    $Found = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $Found) { continue }
    $CandidatePrefix = @()
    if ($Name -eq 'py') { $CandidatePrefix = @('-3') }
    try {
        & $Found.Source @CandidatePrefix -c 'import sys; raise SystemExit(0 if sys.version_info >= (3,11) else 1)' 2>$null
        if ($LASTEXITCODE -eq 0) { $PythonCommand = $Found.Source; $PythonPrefix = $CandidatePrefix; break }
    } catch { continue }
}
if (-not $PythonCommand) { throw 'Install Python 3.11+ and reopen PowerShell before officer setup.' }
& $PythonCommand @PythonPrefix scripts/preflight.py --build
if ($LASTEXITCODE -ne 0) { throw 'Officer preflight failed. Resolve the printed error and retry.' }
$VenvPython = Join-Path (Get-Location) '.venv/Scripts/python.exe'
if ((Test-Path '.venv') -and -not (Test-Path $VenvPython)) { throw 'Existing .venv has no Windows interpreter. Preserve data and recreate the virtual environment locally; setup will not overwrite it.' }
if (-not (Test-Path $VenvPython)) {
    & $PythonCommand @PythonPrefix -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw 'Cannot create the Python virtual environment.' }
}
& $VenvPython scripts/preflight.py --build
if ($LASTEXITCODE -ne 0) { throw 'Virtual environment preflight failed. Recreate .venv if its Python is older than 3.11.' }
& $VenvPython -c 'import fastapi, uvicorn, httpx' 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Installing locked server dependencies. Initial setup requires internet.'
    & $VenvPython -m pip install -r server/requirements.lock.txt
    if ($LASTEXITCODE -ne 0) { throw 'Server setup failed. Check internet access and retry.' }
}
$Npm = (Get-Command npm.cmd -ErrorAction Stop).Source
Push-Location client
try {
    if (-not (Test-Path node_modules)) {
        & $Npm ci --cache (Join-Path ([IO.Path]::GetTempPath()) 'vyuha-npm-cache') --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'Frontend setup failed. Initial setup requires internet.' }
    }
    & $Npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed. Resolve its errors before launching.' }
} finally { Pop-Location }
& $VenvPython -c 'from server.auth import credential_path; import sys; sys.exit(0 if credential_path().is_file() else 2)'
if ($LASTEXITCODE -eq 2) {
    Write-Host 'Provisioning the officer credential. Input is hidden; it is not placed in shell history.'
    & $VenvPython scripts/setup-auth.py
    if ($LASTEXITCODE -ne 0) { throw 'Officer authentication setup failed. Review the printed error and retry scripts/setup-auth.py.' }
} elseif ($LASTEXITCODE -ne 0) { throw 'Cannot check officer authentication setup.' }
Write-Host 'Officer setup complete. Start local: powershell -File scripts/start-local.ps1'
Write-Host 'Start unit LAN: powershell -File scripts/start-unit.ps1'
