/**
 * EscalationPill.jsx
 *
 * Red-flag indicator for escalated customers.
 * Renders a prominent red pill: ● ESCALATED / HUMAN REQUIRED
 *
 * Pragmatic Modernism: 0px radius, IBM Plex Mono, #DC2626 on #FEE2E2.
 */

export default function EscalationPill({ label = 'ESCALATED', compact = false }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[#DC2626] bg-[#FEE2E2] border border-[#FECACA]"
      style={{ borderRadius: 0, fontFamily: "'IBM Plex Mono', monospace" }}
    >
      <span className="text-[#DC2626]">●</span>
      <span className="text-xs font-semibold tracking-wide">
        {compact ? label : `${label} / HUMAN REQUIRED`}
      </span>
    </span>
  );
}
