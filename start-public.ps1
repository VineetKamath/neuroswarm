# Starts NeuroSwarm on this laptop and shares it through a free Cloudflare quick tunnel.
# Run from the project folder:   powershell -ExecutionPolicy Bypass -File .\start-public.ps1
# Keep this window open. The public link works only while this script is running.

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$python = Join-Path $root "backend\venv\Scripts\python.exe"
$cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$port = 8020

# 1. Build the website once (skipped if it is already built).
if (-not (Test-Path (Join-Path $root "frontend\dist\index.html"))) {
    Write-Host "Building the website..."
    Push-Location (Join-Path $root "frontend"); npm run build; Pop-Location
}

# 2. Start the backend, serving the website and the API on one port.
Write-Host "Starting NeuroSwarm on http://localhost:$port ..."
$env:SERVE_FRONTEND = "1"
$server = Start-Process -FilePath $python -ArgumentList "backend\run.py --port $port" -WorkingDirectory $root -PassThru -WindowStyle Minimized
for ($i = 0; $i -lt 90; $i++) {
    try { Invoke-WebRequest "http://localhost:$port/api/health" -UseBasicParsing -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep 2 }
}
Write-Host "Server is up."

# 3. Open the public tunnel. The https://...trycloudflare.com link is printed below.
Write-Host "Opening public link (look for the https://...trycloudflare.com address)..."
try {
    & $cloudflared tunnel --url "http://localhost:$port" --no-autoupdate
} finally {
    Stop-Process -Id $server.Id -ErrorAction SilentlyContinue
}
