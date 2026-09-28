#!/usr/bin/env python
"""
Interactive CLI Test Harness — simulate multi-turn customer conversations.

Usage:
    python -m agent_service.tests.test_agent_cli

    Or from the project root:
    python agent_service/tests/test_agent_cli.py
"""

from __future__ import annotations

import sys
import uuid

# Ensure the project root is on the path
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from agent_service.graph.agent_graph import run_agent_turn


def main() -> None:
    print("=" * 60)
    print("  CRM B2BTrader — AI Agent CLI Test Harness")
    print("=" * 60)
    print("Type your message and press Enter. Type 'quit' to exit.")
    print("Type 'new' to start a new session.\n")

    session_id = str(uuid.uuid4())[:8]
    prior_messages: list = []
    customer_id = input("Customer ID (press Enter to skip): ").strip() or None

    print(f"\n[Session: {session_id}]")
    print("-" * 60)

    while True:
        try:
            user_input = input("\n👤 You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n\nGoodbye!")
            break

        if not user_input:
            continue

        if user_input.lower() == "quit":
            print("\nGoodbye!")
            break

        if user_input.lower() == "new":
            session_id = str(uuid.uuid4())[:8]
            prior_messages = []
            print(f"\n[New session: {session_id}]")
            print("-" * 60)
            continue

        # Run the agent
        try:
            final_state = run_agent_turn(
                message_text=user_input,
                session_id=session_id,
                customer_id=customer_id,
                prior_messages=prior_messages,
            )

            # Update conversation history
            prior_messages = final_state.get("messages", [])

            # Display response
            response = final_state.get("response_text", "(no response)")
            intent = final_state.get("intent", "?")
            confidence = final_state.get("confidence", 0.0)
            citations = final_state.get("citations", [])
            retrieved = final_state.get("retrieved_records", [])

            print(f"\n🤖 Agent: {response}")
            print(f"\n   [Intent: {intent} | Confidence: {confidence:.2f}]")

            if retrieved:
                print(f"   [Retrieved {len(retrieved)} record(s)]")
            if citations:
                print(f"   [Citations: {len(citations)} source(s)]")

            # Show tool calls for debugging
            tool_log = final_state.get("tool_call_log", [])
            if tool_log:
                print(f"   [Tool calls: {len(tool_log)}]")
                for tc in tool_log:
                    tool_name = tc.get("tool_name", "?")
                    elapsed = tc.get("elapsed_ms", 0)
                    print(f"     • {tool_name} ({elapsed:.1f}ms)")

        except Exception as exc:
            print(f"\n❌ Error: {exc}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    main()
