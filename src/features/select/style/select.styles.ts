import type { CSSProperties } from "react";

export const selectFormStyles = {
  host: {
    width: "100%",
    height: "100%",
    minHeight: "0",
    display: "flex",
    flexDirection: "column",
  },
  panel: {
    width: "100%",
    height: "100%",
    minHeight: "0",
    margin: "0 auto",
    padding: "0.75rem 1.5rem 1.25rem 1.5rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    boxSizing: "border-box",
  },
  dropZone: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "1 1 auto",
    minHeight: "0",
    width: "100%",
    margin: "0",
    padding: "2.25rem",
    borderRadius: "0.45rem",
    border: "1.5px dashed color-mix(in srgb, var(--primary-color-light, #008ba3) 48%, rgba(15, 23, 42, 0.18))",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.88), rgba(239,251,253,0.74)), rgba(248, 253, 254, 0.72)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.86), inset 0 0 0 0.45rem rgba(255,255,255,0.32), 0 0.8rem 2rem rgba(0, 92, 122, 0.08)",
    boxSizing: "border-box",
  },
  dropZoneError: {
    borderColor: "#fca5a5",
    background: "linear-gradient(180deg, #fff7f7, #fef2f2)",
  },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.85rem",
    width: "100%",
    maxWidth: "34rem",
    color: "var(--text-color-light)",
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
    color: "var(--text-color-light)",
    fontSize: "1.08rem",
    fontWeight: "700",
    lineHeight: "1.3",
    textAlign: "center",
  },
  separator: {
    margin: "0",
    color: "var(--text-color-light)",
    fontSize: "0.92rem",
    opacity: 0.74,
    lineHeight: "1.3",
    textAlign: "center",
  },
  info: {
    margin: "0",
    color: "var(--text-color-light)",
    fontSize: "0.88rem",
    opacity: 0.72,
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
    padding: "1.05rem 1.35rem",
    color: "var(--text-color-light)",
    borderRadius: "0.45rem",
    border: "1px solid rgba(0, 139, 163, 0.12)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.84), rgba(238,251,252,0.58))",
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
    color: "var(--text-color-light)",
    fontSize: "0.96rem",
    fontWeight: "700",
    lineHeight: "1.25",
  },
  safetyLine: {
    color: "var(--text-color-light)",
    fontSize: "0.86rem",
    lineHeight: "1.35",
    opacity: 0.78,
  },
} satisfies Record<string, CSSProperties>;

export function getSelectDropZoneStyle(isError: boolean): CSSProperties {
  return isError
    ? { ...selectFormStyles.dropZone, ...selectFormStyles.dropZoneError }
    : selectFormStyles.dropZone;
}

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
    borderTop: "1px solid ButtonBorder",
    boxSizing: "border-box",
  },
  actions: {
    display: "flex",
    justifyContent: "center",
    gap: "0.75rem",
    width: "100%",
  },
} satisfies Record<string, CSSProperties>;

export function getSelectReviewHostStyle(isReviewMode: boolean): CSSProperties {
  return {
    ...selectPanelStyles.reviewHost,
    display: isReviewMode ? "block" : "none",
  };
}
