#!/usr/bin/env python3
"""
view_logs.py
Developer & Operator CLI tool to inspect logs and root-cause tracebacks in SalesOS CRM.

Usage:
    python view_logs.py --last            # View the most recent platform event
    python view_logs.py --frontend        # View recent frontend events & clicks
    python view_logs.py --backend         # View recent Django backend log lines
    python view_logs.py --agent           # View recent FastAPI agent log lines
    python view_logs.py --errors          # Search and display recent errors with tracebacks
    python view_logs.py                   # Overview of all log files and status
"""

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime

LOGS_DIR = Path(__file__).resolve().parent / "logs"


def print_header(title: str):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def show_last_event():
    print_header("WHAT HAPPENED LASTLY (logs/last_event.json)")
    last_event_file = LOGS_DIR / "last_event.json"
    if not last_event_file.exists():
        print("  [!] No last_event.json found. The system has not recorded an event yet.")
        return

    try:
        data = json.loads(last_event_file.read_text(encoding="utf-8"))
        print(f"  Timestamp : {data.get('timestamp')}")
        print(f"  Source    : {data.get('source', '').upper()}")
        print(f"  Level     : {data.get('level', '').upper()}")
        print(f"  Message   : {data.get('message')}")
        print(f"  Path      : {data.get('path')}")

        payload = data.get("payload", {})
        if payload:
            print("\n  Payload Details:")
            if "actionTraceback" in payload:
                print(f"    Traceback of User Actions:")
                print(f"      {payload['actionTraceback']}")
            for k, v in payload.items():
                if k not in ("actionTraceback", "recentActions", "recentClicks"):
                    print(f"    {k}: {v}")
            if "recentActions" in payload and isinstance(payload["recentActions"], list):
                print(f"\n    Preceding User Actions ({len(payload['recentActions'])} items):")
                for item in payload["recentActions"]:
                    print(f"      - [{item.get('timestamp', '')[11:19]}] {item.get('action')}: \"{item.get('label')}\" on {item.get('path')}")
    except Exception as exc:
        print(f"  [!] Failed to read last_event.json: {exc}")


def tail_file(file_path: Path, n: int = 25, is_json_lines: bool = False):
    if not file_path.exists():
        print(f"  [!] Log file not found: {file_path.name}")
        return

    lines = file_path.read_text(encoding="utf-8", errors="replace").splitlines()
    recent = lines[-n:] if len(lines) > n else lines

    print(f"  Showing last {len(recent)} entries of {file_path.name} (Total lines: {len(lines)}):\n")
    for line in recent:
        if is_json_lines:
            try:
                item = json.loads(line)
                ts = item.get("timestamp", "")
                if "T" in ts:
                    ts = ts.split("T")[1][:8]
                lvl = item.get("level", "INFO").upper()
                msg = item.get("message", "")
                path = item.get("path", "")
                payload = item.get("payload", {})
                label = payload.get("label", "")
                label_str = f'("{label}")' if label and label not in msg else ''
                path_str = f'@ {path}' if path else ''
                print(f"  [{ts}] [{lvl:5s}] {msg} {label_str} {path_str}")
                if lvl == "ERROR" and payload.get("actionTraceback"):
                    print(f"         Traceback: {payload['actionTraceback']}")
            except Exception:
                print(f"  {line}")
        else:
            print(f"  {line}")


def show_errors():
    print_header("RECENT CRITICAL ERRORS & TRACEBACKS")
    found_any = False

    # Check frontend.log
    frontend_log = LOGS_DIR / "frontend.log"
    if frontend_log.exists():
        lines = frontend_log.read_text(encoding="utf-8", errors="replace").splitlines()
        for line in reversed(lines):
            try:
                item = json.loads(line)
                if item.get("level", "").lower() == "error":
                    found_any = True
                    print(f"\n[FRONTEND ERROR] {item.get('timestamp')}")
                    print(f"  Message   : {item.get('message')}")
                    print(f"  Route Path: {item.get('path')}")
                    payload = item.get("payload", {})
                    if payload.get("actionTraceback"):
                        print(f"  Preceding Actions: {payload['actionTraceback']}")
                    if payload.get("detail"):
                        print(f"  Detail: {payload['detail']}")
                    if payload.get("componentStack"):
                        print(f"  Component Stack: {payload['componentStack'][:200]}...")
            except Exception:
                continue

    # Check backend.log
    backend_log = LOGS_DIR / "backend.log"
    if backend_log.exists():
        lines = backend_log.read_text(encoding="utf-8", errors="replace").splitlines()
        for line in lines[-100:]:
            if "ERROR" in line or "CRITICAL" in line or "Traceback" in line:
                found_any = True
                print(f"\n[BACKEND LOG] {line}")

    # Check agent.log
    agent_log = LOGS_DIR / "agent.log"
    if agent_log.exists():
        lines = agent_log.read_text(encoding="utf-8", errors="replace").splitlines()
        for line in lines[-100:]:
            if "ERROR" in line or "CRITICAL" in line or "Traceback" in line:
                found_any = True
                print(f"\n[AGENT SERVICE LOG] {line}")

    if not found_any:
        print("  [OK] No errors found in recent log entries.")


def show_overview():
    print_header("SALESOS LOGGING OVERVIEW")
    if not LOGS_DIR.exists():
        print(f"  Logs directory does not exist: {LOGS_DIR}")
        return

    log_files = sorted(LOGS_DIR.glob("*"))
    if not log_files:
        print("  Logs directory is empty.")
        return

    print(f"  {'File Name':<28} {'Size (KB)':<12} {'Last Modified':<24}")
    print("  " + "-" * 64)
    for f in log_files:
        size_kb = f.stat().st_size / 1024
        mod_time = datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
        print(f"  {f.name:<28} {size_kb:<12.1f} {mod_time:<24}")

    print("\n  Quick Commands:")
    print("    python view_logs.py --last       # View latest recorded event ('what happened lastly')")
    print("    python view_logs.py --frontend   # Tail frontend user clicks & actions")
    print("    python view_logs.py --backend    # Tail backend Django logs")
    print("    python view_logs.py --agent      # Tail agent service logs")
    print("    python view_logs.py --errors     # Inspect errors and user action tracebacks")


def main():
    parser = argparse.ArgumentParser(description="SalesOS CRM Log Inspector")
    parser.add_argument("--last", action="store_true", help="Show what happened lastly")
    parser.add_argument("--frontend", action="store_true", help="Show recent frontend logs")
    parser.add_argument("--backend", action="store_true", help="Show recent backend logs")
    parser.add_argument("--agent", action="store_true", help="Show recent agent service logs")
    parser.add_argument("--errors", action="store_true", help="Show recent errors with tracebacks")
    parser.add_argument("-n", type=int, default=30, help="Number of lines to show (default: 30)")

    args = parser.parse_args()

    if args.last:
        show_last_event()
    elif args.frontend:
        print_header("FRONTEND LOG (logs/frontend.log)")
        tail_file(LOGS_DIR / "frontend.log", n=args.n, is_json_lines=True)
    elif args.backend:
        print_header("BACKEND LOG (logs/backend.log)")
        tail_file(LOGS_DIR / "backend.log", n=args.n, is_json_lines=False)
    elif args.agent:
        print_header("AGENT SERVICE LOG (logs/agent.log)")
        tail_file(LOGS_DIR / "agent.log", n=args.n, is_json_lines=False)
    elif args.errors:
        show_errors()
    else:
        show_overview()
        show_last_event()


if __name__ == "__main__":
    main()
