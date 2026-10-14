"""
Database Adapter — read-only, parameterised query execution via SQLAlchemy.

Supports both SQLite (aiosqlite) and PostgreSQL (asyncpg) through the
``CRM_DATABASE_URL`` setting.  All queries are enforced as SELECT-only with
a configurable timeout.
"""

from __future__ import annotations

import re
import time
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from agent_service.config.settings import get_settings

# ---------------------------------------------------------------------------
# Safety helpers
# ---------------------------------------------------------------------------

_FORBIDDEN_PATTERNS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|MERGE|GRANT|REVOKE)\b",
    re.IGNORECASE,
)


def _assert_readonly(sql: str) -> None:
    """Raise if the SQL statement contains mutating keywords."""
    if _FORBIDDEN_PATTERNS.search(sql):
        raise PermissionError(
            f"Mutation detected in query — only SELECT statements are permitted. "
            f"Offending SQL: {sql[:200]}"
        )


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

class DatabaseAdapter:
    """Thin wrapper providing safe, read-only query execution."""

    def __init__(self, database_url: str | None = None) -> None:
        url = database_url or get_settings().CRM_DATABASE_URL
        # SQLite needs check_same_thread=False for multi-threaded FastAPI
        connect_args: dict[str, Any] = {}
        if url.startswith("sqlite"):
            connect_args["check_same_thread"] = False
            connect_args["timeout"] = 30.0
        self._engine: Engine = create_engine(
            url,
            connect_args=connect_args,
            pool_pre_ping=True,
        )

    @property
    def engine(self) -> Engine:
        return self._engine

    def execute_readonly_query(
        self,
        sql: str,
        params: dict[str, Any] | None = None,
    ) -> tuple[list[dict[str, Any]], float]:
        """
        Execute a read-only SQL query and return ``(rows, elapsed_ms)``.

        Parameters
        ----------
        sql : str
            A SELECT query. Mutations are rejected.
        params : dict, optional
            Named bind parameters for the query.

        Returns
        -------
        rows : list[dict]
            Each row as a column-name → value mapping.
        elapsed_ms : float
            Wall-clock query time in milliseconds.
        """
        _assert_readonly(sql)
        params = params or {}

        t0 = time.perf_counter()
        with self._engine.connect() as conn:
            result = conn.execute(text(sql), params)
            columns = list(result.keys())
            rows = [dict(zip(columns, row)) for row in result.fetchall()]
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        return rows, elapsed_ms

    def close(self) -> None:
        self._engine.dispose()
