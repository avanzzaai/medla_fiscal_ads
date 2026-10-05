"""Función serverless de Vercel: POST /api/form/fiscal (vercel.json reescribe a /api/form?name=fiscal).

En Vercel no hay disco persistente, así que el lead se envía a HighLevel en el momento.
Sin token (GHL_PIT) o si HighLevel falla, responde con error para que la persona use el
teléfono o WhatsApp que le muestra la página, y el registro queda en los logs de la función.
"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _crm as crm  # noqa: E402
import _forms as forms  # noqa: E402

RETRY = "No pudimos enviar tu mensaje. Inténtalo de nuevo en unos minutos o escríbenos por WhatsApp."


class handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        url = urlparse(self.path)
        name = (parse_qs(url.query).get("name") or [url.path.rstrip("/").rsplit("/", 1)[-1]])[0]
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        raw = self.rfile.read(length) if 0 < length <= forms.MAX_BODY else b""
        status, payload, record = forms.validate(name, raw)
        if not isinstance(record, dict):
            return self._json(status, payload)
        if not crm.enabled():
            print(json.dumps({"sin_token_ghl": True, "form": name, "record": record}, ensure_ascii=False))
            return self._json(503, {"ok": False, "error": RETRY})
        try:
            result = crm.push(name, record)
            print(json.dumps({"form": name, "ok": True, **result}))
        except Exception as err:  # el lead queda en los logs de Vercel
            print(json.dumps({"form": name, "ok": False, "error": str(err), "record": record}, ensure_ascii=False))
            return self._json(502, {"ok": False, "error": RETRY})
        return self._json(200, payload)

    def do_GET(self):
        self._json(405, {"ok": False, "error": "Usa POST"})
