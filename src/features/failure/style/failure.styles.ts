import type { CSSProperties } from "react";

export const failureStyles = {
  panel: { boxSizing: "border-box", color: "var(--body-ink)", display: "grid", gap: "1rem", minWidth: 0, padding: "var(--panel-content-padding)", textAlign: "left", width: "100%" },
  failure: { border: "1px solid var(--border-card)", borderRadius: "var(--radius-control)", display: "grid", gap: "0.375rem", padding: "0.875rem 1rem", overflowWrap: "anywhere" },
  failureTitle: { color: "var(--error-text-color-light)", fontSize: "0.875rem", fontWeight: 700 },
  message: { fontSize: "0.92rem", lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap" },
  details: { alignItems: "baseline", display: "flex", flexWrap: "wrap", fontSize: "0.875rem", gap: "0.375rem 0.75rem", margin: 0, minWidth: 0, overflowWrap: "anywhere" },
  label: { color: "var(--slate-500)", fontWeight: 500 },
  value: { margin: 0, whiteSpace: "pre-wrap" },
  heading: { color: "var(--title-ink)", fontSize: "0.95rem", fontWeight: 700, margin: "0.25rem 0 -0.375rem" },
  tableFrame: { border: "1px solid var(--border-card)", borderRadius: "var(--radius-control)", minWidth: 0, overflowX: "auto" },
  table: { borderCollapse: "collapse", fontSize: "0.875rem", lineHeight: 1.45, minWidth: "24rem", tableLayout: "fixed", textAlign: "left", width: "100%" },
  tableHead: { background: "var(--gray-50)", color: "var(--slate-500)", fontSize: "0.78rem" },
  cell: { borderBottom: "1px solid var(--border-card)", fontWeight: 600, overflowWrap: "anywhere", padding: "0.625rem 0.75rem", verticalAlign: "middle" },
  service: { color: "var(--title-ink)", fontWeight: 500 },
  pairStart: { borderLeft: "1px solid var(--border-card)" },
  level: { paddingLeft: "0.375rem", paddingRight: "0.375rem", textAlign: "right", whiteSpace: "nowrap", width: "3.25rem" },
  enabled: { background: "var(--accent-surface)", borderRadius: "var(--radius-pill)", color: "var(--primary-dark)", display: "inline-block", fontSize: "0.78rem", fontWeight: 600, padding: "0.125rem 0.5rem" },
  actions: { borderTop: "1px solid var(--border-card)", display: "flex", justifyContent: "flex-end", paddingTop: "1rem" },
} satisfies Record<string, CSSProperties>;
