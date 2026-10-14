import type { CSSProperties } from "react";

export const jurisdictionStyles = {
  row: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.5fr)", gap: "0.75rem", alignItems: "start" },
  field: { display: "flex", flexDirection: "column", gap: "0.35rem", minWidth: 0 },
  input: {
    boxSizing: "border-box", width: "100%", minWidth: 0, minHeight: "2.75rem", padding: "0.5rem",
    font: "inherit", color: "var(--title-ink)", background: "var(--white)",
    border: "1px solid var(--border-card)", borderRadius: "var(--radius-control)",
  },
  results: {
    maxHeight: "12rem", overflowY: "auto", overscrollBehavior: "contain", padding: "0.25rem",
    border: "1px solid var(--border-card)", borderRadius: "var(--radius-control)",
    background: "var(--white)", scrollPadding: "0.25rem",
  },
  option: {
    padding: "0.65rem 0.5rem", cursor: "pointer", color: "var(--title-ink)",
    borderRadius: "var(--radius-control)", overflowWrap: "anywhere",
  },
  active: { background: "var(--primary-dark)", color: "var(--white)" },
} satisfies Record<string, CSSProperties>;
