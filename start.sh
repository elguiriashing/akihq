#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
URL="http://127.0.0.1:8080"

if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 || true; fi
if command -v open >/dev/null 2>&1; then open "$URL" >/dev/null 2>&1 || true; fi

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server 8080 --bind 127.0.0.1
fi
if command -v python >/dev/null 2>&1; then
  exec python -m http.server 8080 --bind 127.0.0.1
fi

echo "Python 3 was not found. Install it, or open index.html directly."
exit 1
