import type { CSSProperties } from "react";

export const choiceFormStyles = {
  panel: {
    alignItems: "stretch",
    boxSizing: "border-box",
    color: "var(--title-ink)",
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    overflow: "hidden",
    textAlign: "left",
    width: "100%",
  },
  panelHeader: {
    alignItems: "center",
    borderBottom: "1px solid var(--border-card)",
    boxSizing: "border-box",
    display: "flex",
    flex: "0 0 auto",
    gap: "var(--panel-header-gap)",
    justifyContent: "space-between",
    minHeight: "var(--panel-header-height)",
    padding: "var(--panel-header-padding)",
    width: "100%",
  },
  panelTitle: {
    fontSize: "var(--panel-title-size)",
    fontWeight: "var(--panel-title-weight)",
    letterSpacing: "var(--panel-title-tracking)",
    lineHeight: "var(--panel-title-line-height)",
    margin: 0,
  },
  panelBody: {
    boxSizing: "border-box",
    flex: "1 1 auto",
    minHeight: 0,
    overflowX: "hidden",
    overflowY: "auto",
    padding: "0.75rem var(--panel-content-padding) var(--panel-content-padding)",
    width: "100%",
  },
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    width: "100%",
    boxSizing: "border-box",
  },
  form: {
    textAlign: "left",
    width: "100%",
  },
  label: {
    display: "block",
  },
  badge: {
    marginLeft: ".5rem",
    fontWeight: 600,
    opacity: 0.85,
  },
  footer: {
    display: "flex",
    justifyContent: "center",
    gap: "0.75rem",
    marginTop: "1.5rem",
  },
} satisfies Record<string, CSSProperties>;

