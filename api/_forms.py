"""Validación del formulario "Prefiero que me llamen" de la landing fiscal (copia de medla-asesores/forms.py)."""
from __future__ import annotations

import datetime
import json
import re

# Campos obligatorios por formulario
FORMS = {
    "fiscal": ["name", "email", "phone", "topic", "consent_processing"],
}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MAX_BODY = 64 * 1024
SPAM = "spam"


def validate(name: str, raw: bytes) -> tuple[int, dict, dict | str | None]:
    """Devuelve (estado HTTP, respuesta JSON, registro). El registro es SPAM si cayó en el señuelo."""
    if name not in FORMS:
        return 404, {"ok": False, "error": "Formulario no encontrado"}, None
    if not raw or len(raw) > MAX_BODY:
        return 413, {"ok": False, "error": "Solicitud inválida"}, None
    try:
        data = json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return 400, {"ok": False, "error": "JSON inválido"}, None
    if not isinstance(data, dict):
        return 400, {"ok": False, "error": "JSON inválido"}, None
    if data.get("website"):  # señuelo anti-spam: los humanos lo dejan vacío
        return 200, {"ok": True}, SPAM
    missing = [f for f in FORMS[name] if not data.get(f)]
    if missing:
        return 422, {"ok": False, "error": "Faltan campos obligatorios", "fields": missing}, None
    if not EMAIL_RE.match(str(data.get("email", ""))):
        return 422, {"ok": False, "error": "Correo no válido", "fields": ["email"]}, None
    record = {k: (v if isinstance(v, (str, int, float, bool, list)) else str(v)) for k, v in data.items()}
    record["_received"] = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
    record["_form"] = name
    return 200, {"ok": True}, record
