#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 não encontrado. Instale o Python 3 para abrir a prévia local."
  exit 1
fi

python3 - "$@" <<'PY'
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import webbrowser

public_dir = Path("public").resolve()
handler = partial(SimpleHTTPRequestHandler, directory=str(public_dir))
server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
url = f"http://127.0.0.1:{server.server_port}/"

print(f"Prévia do cardápio: {url}", flush=True)
print("Deixe esta janela aberta enquanto navega. Pressione Ctrl+C para encerrar.", flush=True)
if "--no-open" not in sys.argv[1:]:
    webbrowser.open(url)

try:
    server.serve_forever()
except KeyboardInterrupt:
    print("\nPrévia encerrada.")
finally:
    server.server_close()
PY
