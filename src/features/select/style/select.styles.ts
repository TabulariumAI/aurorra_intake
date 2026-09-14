import type { CSSProperties } from "react";

export const selectFormStyles = {
  host: {
    width: "min(42rem, 100%)",
    height: "100%",
    minHeight: "0",
    display: "flex",
    flexDirection: "column",
  },
  panel: {
    width: "100%",
    height: "100%",
    minHeight: "0",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: "1.25rem",
    boxSizing: "border-box",
  },
  dropZone: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "1 1 auto",
    minHeight: "18rem",
    width: "100%",
    margin: "0",
    padding: "clamp(1.5rem, 5vw, 2.5rem)",
    boxSizing: "border-box",
  },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.85rem",
    width: "100%",
    maxWidth: "34rem",
    color: "var(--title-ink)",
  },
  docIcon: {
    display: "inline-flex",
    width: "6.25rem",
    height: "6.25rem",
    marginBottom: "0.55rem",
    filter: "drop-shadow(0 0.7rem 1rem rgba(0, 92, 122, 0.12))",
  },
  title: {
    margin: "0",
    color: "var(--title-ink)",
    fontSize: "1.08rem",
    fontWeight: "700",
    lineHeight: "1.45",
    textAlign: "center",
  },
  separator: {
    margin: "0",
    color: "var(--body-ink)",
    fontSize: "0.92rem",
    lineHeight: "1.45",
    textAlign: "center",
  },
  info: {
    margin: "0",
    color: "var(--body-ink)",
    fontSize: "0.88rem",
    lineHeight: "1.45",
    textAlign: "center",
  },
  infoError: {
    color: "#991b1b",
  },
  safety: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    width: "100%",
    margin: "0",
    padding: "0 0 0.25rem",
    color: "var(--title-ink)",
    textAlign: "left",
    boxSizing: "border-box",
  },
  shield: {
    display: "inline-flex",
    flex: "0 0 auto",
    width: "3.25rem",
    height: "3.25rem",
    filter: "drop-shadow(0 0.45rem 0.65rem rgba(0, 92, 122, 0.10))",
  },
  safetyCopy: {
    display: "flex",
    flexDirection: "column",
    gap: "0.3rem",
  },
  safetyTitle: {
    color: "var(--body-ink)",
    fontSize: "0.96rem",
    fontWeight: "700",
    lineHeight: "1.25",
  },
  safetyLine: {
    color: "var(--text-color-light)",
    fontSize: "0.86rem",
    lineHeight: "1.45",
  },
} satisfies Record<string, CSSProperties>;

export function getSelectInfoStyle(isError: boolean): CSSProperties {
  return isError
    ? { ...selectFormStyles.info, ...selectFormStyles.infoError }
    : selectFormStyles.info;
}

export const selectViewerStyle = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    minHeight: "0",
    flex: "1 1 auto",
  },
  lens: {
    width: "100%",
    height: "100%",
    minHeight: "0",
    flex: "1 1 auto",
  },
  nav: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "0.5rem",
    flex: "0 0 auto",
    margin: "0.85rem 0 0 0",
    padding: "0.5rem 0 0 0",
  },
  icon: {
    display: "block",
    width: "1.15rem",
    height: "1.15rem",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: "1.7",
  },
} satisfies Record<string, CSSProperties>;

export const wrapperStyles = selectViewerStyle.wrapper;

export const selectPanelStyles = {
  host: {
    width: "100%",
    height: "100%",
    minHeight: "0",
    display: "flex",
    flexDirection: "column",
  },
  reviewHost: {
    width: "100%",
    flex: "1 1 auto",
    minHeight: "0",
    boxSizing: "border-box",
  },
  reviewPanel: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    marginTop: "1.25rem",
    minHeight: "5.25rem",
    padding: "1rem 0 1.1rem 0",
    borderTop: "1px solid var(--border-card)",
    boxSizing: "border-box",
  },
  actions: {
    display: "flex",
    justifyContent: "center",
    gap: "0.75rem",
    width: "100%",
  },
} satisfies Record<string, CSSProperties>;
