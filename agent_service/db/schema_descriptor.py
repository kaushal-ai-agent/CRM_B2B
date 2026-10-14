"""
Schema Descriptor — loads the YAML schema at runtime so tools can build
queries against arbitrary database schemas without hard-coding.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from agent_service.config.settings import get_settings


# ---------------------------------------------------------------------------
# Data-classes mirroring the YAML structure
# ---------------------------------------------------------------------------

@dataclass
class ColumnDescriptor:
    name: str
    type: str
    description: str
    nullable: bool = False


@dataclass
class ForeignKey:
    column: str
    references_table: str
    references_column: str


@dataclass
class TableDescriptor:
    name: str
    description: str
    primary_key: str
    columns: list[ColumnDescriptor] = field(default_factory=list)
    foreign_keys: list[ForeignKey] = field(default_factory=list)

    @property
    def column_names(self) -> list[str]:
        return [c.name for c in self.columns]

    def column_description_block(self) -> str:
        """Return a human-readable block suitable for injection into an LLM prompt."""
        lines: list[str] = [f"Table: {self.name}  —  {self.description}"]
        for col in self.columns:
            lines.append(f"  • {col.name} ({col.type}): {col.description}")
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

class SchemaRegistry:
    """Load and query the runtime schema descriptor."""

    def __init__(self, config_path: str | Path | None = None) -> None:
        self._path = Path(config_path or get_settings().SCHEMA_CONFIG_PATH)
        self._tables: dict[str, TableDescriptor] = {}
        self._load()

    # -- loading -----------------------------------------------------------

    def _load(self) -> None:
        with open(self._path, "r", encoding="utf-8") as fh:
            raw: dict[str, Any] = yaml.safe_load(fh)

        for tbl in raw.get("tables", []):
            columns = [
                ColumnDescriptor(**col) for col in tbl.get("columns", [])
            ]
            fks = [
                ForeignKey(**fk) for fk in tbl.get("foreign_keys", [])
            ]
            descriptor = TableDescriptor(
                name=tbl["name"],
                description=tbl.get("description", ""),
                primary_key=tbl.get("primary_key", "id"),
                columns=columns,
                foreign_keys=fks,
            )
            self._tables[descriptor.name] = descriptor

    # -- public API --------------------------------------------------------

    def get_table(self, name: str) -> TableDescriptor | None:
        return self._tables.get(name)

    def list_tables(self) -> list[str]:
        return list(self._tables.keys())

    def get_product_table(self) -> TableDescriptor:
        """Convenience: return the first table whose name contains 'product'."""
        for name, tbl in self._tables.items():
            if "product" in name.lower():
                return tbl
        raise ValueError("No product table found in schema descriptor")

    def full_schema_prompt(self) -> str:
        """Return a complete schema description for LLM context injection."""
        blocks = [tbl.column_description_block() for tbl in self._tables.values()]
        return "\n\n".join(blocks)
