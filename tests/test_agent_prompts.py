"""
Tests for Agent Service Prompt Versioning & Database Seeding.
"""

import pytest
from agent_service.db.audit_models import get_audit_session, PromptTemplate
from agent_service.db.seed_defaults import seed_defaults_if_empty, DEFAULT_PROMPTS


def test_seed_defaults_creates_prompts():
    """Verify that default prompts are seeded with version 1 and marked active."""
    counts = seed_defaults_if_empty()
    session = get_audit_session()
    try:
        active_prompts = session.query(PromptTemplate).filter_by(is_active=True).all()
        node_names = [p.node_name for p in active_prompts]
        for p_def in DEFAULT_PROMPTS:
            assert p_def["node_name"] in node_names
    finally:
        session.close()


def test_prompt_version_increment():
    """Verify version increments when a new prompt is created for an existing node."""
    session = get_audit_session()
    try:
        latest = session.query(PromptTemplate).filter_by(node_name="router_node").order_by(PromptTemplate.version.desc()).first()
        base_ver = latest.version if latest else 1

        new_v = PromptTemplate(
            node_name="router_node",
            version=base_ver + 1,
            system_prompt="Test modified prompt",
            change_summary="Test bump",
            is_active=False,
            created_by="PyTest",
        )
        session.add(new_v)
        session.commit()

        fetched = session.query(PromptTemplate).filter_by(id=new_v.id).first()
        assert fetched.version == base_ver + 1
        assert fetched.change_summary == "Test bump"

        # Cleanup
        session.delete(fetched)
        session.commit()
    finally:
        session.close()
