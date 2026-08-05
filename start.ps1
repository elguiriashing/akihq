$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$python = Get-Command py -ErrorAction SilentlyContinue
if ($python) {
    Start-Process "http://127.0.0.1:8080"
    & py -3 -m http.server 8080 --bind 127.0.0.1
    exit
}
$python = Get-Command python -ErrorAction SilentlyContinue
if ($python) {
    Start-Process "http://127.0.0.1:8080"
    & python -m http.server 8080 --bind 127.0.0.1
    exit
}
Write-Host "Python 3 was not found. Install it, or open index.html directly." -ForegroundColor Yellow
Read-Host "Press Enter to close"
