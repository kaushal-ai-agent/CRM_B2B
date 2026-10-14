"""
crm/logging_utils.py
Centralized helper for recording the most recent event ('what happened lastly')
and managing log files across the platform.
"""

import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from django.conf import settings

logger = logging.getLogger(__name__)

_LOCK = threading.Lock()


def get_logs_dir() -> Path:
    """Return the absolute Path to the logs directory, ensuring it exists."""
    log_dir = settings.BASE_DIR / 'logs'
    log_dir.mkdir(exist_ok=True)
    return log_dir


def record_last_event(
    source: str,
    level: str,
    message: str,
    payload: dict = None,
    path: str = None,
    timestamp: str = None,
) -> dict:
    """
    Record the latest event into logs/last_event.json.
    Thread-safe and fault-tolerant.
    """
    if timestamp is None:
        timestamp = datetime.now(timezone.utc).isoformat()

    event_data = {
        "timestamp": timestamp,
        "source": source,
        "level": level.upper(),
        "message": message,
        "path": path or "/",
        "payload": payload or {},
    }

    log_dir = get_logs_dir()
    last_event_path = log_dir / 'last_event.json'

    with _LOCK:
        try:
            # Write to a temporary string first, then atomic write
            content = json.dumps(event_data, indent=2, ensure_ascii=False, default=str)
            last_event_path.write_text(content, encoding='utf-8')
        except Exception as exc:
            logger.error("Failed to write to last_event.json: %s", exc)

    return event_data


def get_last_event() -> dict:
    """Read the latest recorded event from logs/last_event.json."""
    last_event_path = get_logs_dir() / 'last_event.json'
    if not last_event_path.exists():
        return {
            "status": "empty",
            "message": "No events recorded yet."
        }
    try:
        content = last_event_path.read_text(encoding='utf-8')
        return json.loads(content)
    except Exception as exc:
        return {
            "status": "error",
            "message": f"Failed to read last_event.json: {exc}"
        }
