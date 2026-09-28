"""
Input Guardrails — sanitise inbound messages and block prompt injection.

Also provides an output guardrail that checks the synthesised response for
ungrounded price / stock claims.
"""

from __future__ import annotations

import re


# ---------------------------------------------------------------------------
# Prompt-injection patterns
# ---------------------------------------------------------------------------

_INJECTION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"ignore\s+(all\s+)?previous\s+instructions", re.IGNORECASE),
    re.compile(r"ignore\s+(all\s+)?above", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(a|an)\s+", re.IGNORECASE),
    re.compile(r"system\s*:\s*", re.IGNORECASE),
    re.compile(r"<\s*\|?\s*(system|im_start|endoftext)", re.IGNORECASE),
    re.compile(r"act\s+as\s+(a\s+)?", re.IGNORECASE),
    re.compile(r"pretend\s+(you|to)\s+", re.IGNORECASE),
    re.compile(r"(reveal|show|display)\s+(your\s+)?(system\s+)?prompt", re.IGNORECASE),
    re.compile(r"override\s+(the\s+)?(price|discount|cost)", re.IGNORECASE),
    re.compile(r"give\s+(me\s+)?(a\s+)?(special|extra)\s+discount", re.IGNORECASE),
    re.compile(r"change\s+(the\s+)?price\s+to", re.IGNORECASE),
    re.compile(r"set\s+(the\s+)?price\s+(to|at)", re.IGNORECASE),
]


class GuardrailResult:
    """Outcome of a guardrail check."""

    __slots__ = ("is_safe", "reason", "sanitized_text")

    def __init__(self, is_safe: bool, sanitized_text: str, reason: str = ""):
        self.is_safe = is_safe
        self.sanitized_text = sanitized_text
        self.reason = reason


# ---------------------------------------------------------------------------
# Input guardrail
# ---------------------------------------------------------------------------

def check_input(raw_text: str) -> GuardrailResult:
    """
    Validate and sanitise the inbound customer message.

    Returns
    -------
    GuardrailResult
        ``is_safe=False`` if the message should be rejected.
    """
    # 1. Empty / whitespace-only
    stripped = raw_text.strip()
    if not stripped:
        return GuardrailResult(
            is_safe=False,
            sanitized_text="",
            reason="Empty or whitespace-only input.",
        )

    # 2. Excessively long
    if len(stripped) > 2000:
        stripped = stripped[:2000]

    # 3. Prompt injection scan
    for pattern in _INJECTION_PATTERNS:
        if pattern.search(stripped):
            return GuardrailResult(
                is_safe=False,
                sanitized_text=stripped,
                reason=f"Prompt injection detected: matched pattern '{pattern.pattern}'",
            )

    # 4. Basic cleanup — collapse multiple whitespace
    sanitized = re.sub(r"\s+", " ", stripped)

    return GuardrailResult(is_safe=True, sanitized_text=sanitized)


# ---------------------------------------------------------------------------
# Output guardrail  (post-synthesis)
# ---------------------------------------------------------------------------

_CURRENCY_PATTERN = re.compile(
    r"(?:₹|Rs\.?|\$)\s*([\d,]+\.?\d*)",
    re.IGNORECASE,
)


def check_output_grounding(
    response_text: str,
    retrieved_prices: list[float],
) -> bool:
    """
    Return ``True`` if every monetary value in *response_text* appears in
    *retrieved_prices*.  If a price is mentioned that was **not** retrieved
    from the database, return ``False`` (hallucination detected).
    """
    matches = _CURRENCY_PATTERN.findall(response_text)
    if not matches:
        return True  # No prices mentioned → fine

    for numeric_str in matches:
        # The capturing group already isolated the numeric part
        cleaned = numeric_str.replace(",", "").strip()
        try:
            value = float(cleaned)
        except ValueError:
            continue
        # Allow if this exact value (or within 0.01 tolerance) was retrieved
        if not any(abs(value - p) < 0.02 for p in retrieved_prices):
            return False

    return True
