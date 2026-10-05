"""Envía los leads de la landing fiscal a HighLevel (sub-cuenta MEDLA Asesores).
Copia de medla-asesores/crm.py; en Vercel solo se usa push() (envío síncrono).

Por cada envío:
  1. crea o actualiza el contacto (HighLevel deduplica por correo y teléfono),
     con la etiqueta base "web-medla", la del formulario y las del trámite o plan;
  2. añade una nota con todo lo que escribió la persona;
  3. si ghl.json tiene pipeline, crea una oportunidad en la etapa indicada;
  4. si el formulario lo pide, crea una tarea de seguimiento para el equipo;
  5. si el formulario tiene workflowId, inscribe el contacto en ese workflow.

Credencial: variable de entorno GHL_PIT del proyecto de Vercel (nunca en ghl.json ni en el repositorio).
Sin token, la web sigue funcionando y los envíos quedan solo en data/<form>.jsonl.
Los envíos que fallan quedan en data/ghl-pending.jsonl; se reenvían con
    python3 tools/ghl_retry.py
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import threading
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = Path(os.environ.get("MEDLA_DATA_DIR") or ROOT / "data")
CONFIG_FILE = Path(os.environ.get("GHL_CONFIG") or ROOT / "ghl.json")
MEDLA_LOCATION_ID = "1rwiAa5WV7vLJLmm8Af7"
_lock = threading.Lock()


def load_env(path: Path = ROOT / ".env") -> None:
    """Carga CLAVE=valor de .env sin pisar variables ya definidas."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", line)
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = re.sub(r"^(['\"])(.*)\1$", r"\2", m.group(2))


def load_config() -> dict:
    return json.loads(CONFIG_FILE.read_text(encoding="utf-8")) if CONFIG_FILE.exists() else {}


def token() -> str:
    return os.environ.get("GHL_PIT", "").strip()


def enabled() -> bool:
    return token().startswith("pit-")


def base_url() -> str:
    return os.environ.get("GHL_BASE_URL", "https://services.leadconnectorhq.com").rstrip("/")


class GhlError(Exception):
    def __init__(self, status: int, message: str, details=None):
        super().__init__(message)
        self.status = status
        self.details = details


def request(method: str, path: str, body: dict | None = None, version: str = "2021-07-28") -> dict:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(base_url() + path, data=data, method=method, headers={
        "Authorization": f"Bearer {token()}",
        "Version": version,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "medla-web/1.0",
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            raw = res.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", "replace")
        try:
            details = json.loads(raw)
        except ValueError:
            details = {"raw": raw[:500]}
        msg = details.get("message") if isinstance(details, dict) else None
        if isinstance(msg, list):
            msg = "; ".join(map(str, msg))
        raise GhlError(err.code, f"HighLevel {err.code} en {method} {path}: {msg or err.reason}", details) from None
    except urllib.error.URLError as err:
        raise GhlError(0, f"Sin conexión con HighLevel: {err.reason}") from None


# --------------------------------------------------------------------------
# Traducción de los formularios de la web a HighLevel
# --------------------------------------------------------------------------
def slug(text: str) -> str:
    text = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60]


def split_name(full: str) -> tuple[str, str]:
    parts = str(full or "").strip().split(None, 1)
    return (parts[0], parts[1]) if len(parts) == 2 else ((parts[0], "") if parts else ("", ""))


def clean_phone(raw: str) -> str:
    """'+34 600 11 22 33' -> '+34600112233'. Devuelve '' si no parece un teléfono."""
    raw = str(raw or "").strip()
    digits = re.sub(r"\D", "", raw)
    if len(digits) < 6:
        return ""
    return ("+" if raw.startswith("+") or raw.startswith("00") else "") + (digits[2:] if raw.startswith("00") else digits)


FIELD_LABELS = {
    "firstname": "Nombre", "lastname": "Apellidos", "name": "Nombre", "email": "Correo", "phone": "Teléfono",
    "message": "Mensaje", "tramite": "Trámite", "plan": "Plan", "subject": "Asunto", "schedule": "Horario preferido",
    "consent_comms": "Acepta comunicaciones", "consent_processing": "Acepta tratamiento de datos", "page": "Página",
    "city": "Ciudad", "move_in": "Entrada prevista", "stay": "Duración de la estancia",
    "consent_share": "Acepta compartir sus datos con VIBE stay",
    "topic": "Tema de la consulta", "utm_source": "UTM source", "utm_medium": "UTM medium",
    "utm_campaign": "UTM campaign", "utm_term": "UTM term", "utm_content": "UTM content",
}


def note_body(name: str, label: str, record: dict) -> str:
    lines = [f"Formulario web: {label}", f"Recibido: {record.get('_received', '')}"]
    for key, value in record.items():
        if key.startswith("_") or key == "website":
            continue
        if isinstance(value, bool):
            value = "sí" if value else "no"
        elif isinstance(value, list):
            value = ", ".join(map(str, value))
        if value in ("", None):
            continue
        lines.append(f"{FIELD_LABELS.get(key, key)}: {value}")
    return "\n".join(lines)


def contact_payload(name: str, record: dict, cfg: dict, form_cfg: dict) -> dict:
    first, last = record.get("firstname", ""), record.get("lastname", "")
    if not first and record.get("name"):
        first, last = split_name(record["name"])
    tags = list(cfg.get("baseTags", [])) + list(form_cfg.get("tags", []))
    if record.get("tramite"):
        tags.append(f"tramite-{slug(record['tramite'])}")
    if record.get("plan"):
        tags.append(f"plan-{slug(record['plan'])}")
    if record.get("city"):
        tags.append(f"ciudad-{slug(record['city'])}")
    if record.get("consent_comms") is True or name == "newsletter":
        tags.append("acepta-comunicaciones")
    payload = {
        "locationId": cfg.get("locationId", MEDLA_LOCATION_ID),
        "firstName": first,
        "lastName": last,
        "email": record.get("email", ""),
        "phone": clean_phone(record.get("phone", "")),
        "source": f"{cfg.get('source', 'Web')} · {form_cfg.get('label', name)}",
        "tags": sorted(set(t for t in tags if t)),
    }
    if cfg.get("assignedTo"):
        payload["assignedTo"] = cfg["assignedTo"]
    return {k: v for k, v in payload.items() if v not in ("", None, [])}


def push(name: str, record: dict) -> dict:
    """Envía un registro a HighLevel. Devuelve {'contactId', 'opportunityId', ...}. Lanza GhlError si falla."""
    cfg = load_config()
    if cfg.get("locationId", MEDLA_LOCATION_ID) != MEDLA_LOCATION_ID:
        raise GhlError(0, "ghl.json apunta a otra sub-cuenta; solo se permite MEDLA Asesores")
    form_cfg = cfg.get("forms", {}).get(name, {"label": name, "tags": [f"form-{name}"]})
    label = form_cfg.get("label", name)
    payload = contact_payload(name, record, cfg, form_cfg)
    try:
        res = request("POST", "/contacts/upsert", payload)
    except GhlError as err:
        # Un teléfono que HighLevel no acepta no debe perder el lead: se reintenta sin él (queda en la nota)
        if "phone" in payload and err.status in (400, 422) and "phone" in str(err).lower():
            payload.pop("phone")
            res = request("POST", "/contacts/upsert", payload)
        else:
            raise
    contact = res.get("contact") or {}
    contact_id = contact.get("id")
    if not contact_id:
        raise GhlError(0, "HighLevel no devolvió el ID del contacto", res)
    out = {"contactId": contact_id, "new": res.get("new")}

    request("POST", f"/contacts/{contact_id}/notes", {"body": note_body(name, label, record)})

    full_name = " ".join(x for x in (payload.get("firstName"), payload.get("lastName")) if x) or payload.get("email", "")
    pipe = cfg.get("pipeline", {})
    if form_cfg.get("opportunity") and pipe.get("pipelineId") and pipe.get("stageId"):
        opp = request("POST", "/opportunities/", {
            "locationId": payload["locationId"],
            "pipelineId": pipe["pipelineId"],
            "pipelineStageId": pipe["stageId"],
            "contactId": contact_id,
            "name": f"{full_name} · {record.get('plan') or record.get('tramite') or label}",
            "status": "open",
            "source": payload["source"],
            **({"assignedTo": cfg["assignedTo"]} if cfg.get("assignedTo") else {}),
        })
        out["opportunityId"] = (opp.get("opportunity") or {}).get("id")

    if form_cfg.get("task"):
        due = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
        task = {"title": f"Responder lead web ({label}): {full_name}", "body": note_body(name, label, record),
                "dueDate": due, "completed": False}
        if cfg.get("assignedTo"):
            task["assignedTo"] = cfg["assignedTo"]
        request("POST", f"/contacts/{contact_id}/tasks", task)

    if form_cfg.get("workflowId"):
        request("POST", f"/contacts/{contact_id}/workflow/{form_cfg['workflowId']}", {})
    return out


def _append(file: str, entry: dict) -> None:
    DATA.mkdir(exist_ok=True)
    with _lock, open(DATA / file, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def push_logged(name: str, record: dict) -> bool:
    """push() con registro en data/ghl-log.jsonl y cola de reintento en data/ghl-pending.jsonl."""
    at = dt.datetime.now().astimezone().isoformat(timespec="seconds")
    try:
        result = push(name, record)
        _append("ghl-log.jsonl", {"at": at, "form": name, "ok": True, **result})
        return True
    except Exception as err:  # el lead nunca se pierde: queda en la cola
        _append("ghl-log.jsonl", {"at": at, "form": name, "ok": False, "error": str(err)})
        _append("ghl-pending.jsonl", {"form": name, "record": record, "error": str(err), "at": at})
        return False


def push_async(name: str, record: dict) -> None:
    """No hace esperar a quien envía el formulario: HighLevel se llama en segundo plano."""
    threading.Thread(target=push_logged, args=(name, record), daemon=True).start()


load_env()
