@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  echo Starting AkiHQ at http://127.0.0.1:8080
  start "" "http://127.0.0.1:8080"
  py -3 -m http.server 8080 --bind 127.0.0.1
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo Starting AkiHQ at http://127.0.0.1:8080
  start "" "http://127.0.0.1:8080"
  python -m http.server 8080 --bind 127.0.0.1
  goto :eof
)

echo Python 3 was not found.
echo Install Python from python.org, or open index.html directly.
pause
