import type { CSSProperties } from "react";

const shellLayoutGapRem = 0.75;
const shellMainPanelMinRem = 42;
const shellMainPanelMaxRem = 56;

export const intakeContainerStyles = {
  shell: {
    display: "flex",
    flexDirection: "column",
    margin: "0",
    flex: `0 0 clamp(${shellMainPanelMinRem}rem, 46vw, ${shellMainPanelMaxRem}rem)`,
    width: "auto",
    maxWidth: "none",
    minWidth: `${shellMainPanelMinRem}rem`,
    height: "100%",
    minHeight: "0",
    overflow: "hidden",
    verticalAlign: "top",
    textAlign: "center",
    boxSizing: "border-box",
    position: "relative",
    padding: "1.55rem",
    borderRadius: "0",
    boxShadow: "none",
    borderStyle: "none",
    backgroundColor: "transparent",
  },
  header: {
    flex: "0 0 auto",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: "0.45rem",
    margin: "0 0 1.15rem 0",
    textAlign: "center",
    color: "var(--text-color-light)",
  },
  title: {
    margin: "0",
    width: "100%",
    color: "var(--text-color-light)",
    fontSize: "1.35rem",
    fontWeight: 700,
    lineHeight: "1.25",
    textAlign: "center",
  },
  helper: {
    margin: "0",
    width: "min(100%, 44rem)",
    color: "var(--text-color-light)",
    fontSize: "0.92rem",
    lineHeight: "1.45",
    opacity: 0.76,
    textAlign: "center",
  },
  slot: {
    flexDirection: "column",
    justifyContent: "flex-start",
    alignItems: "stretch",
    width: "100%",
    height: "100%",
    minHeight: "30rem",
    flex: "1 1 auto",
    position: "relative",
    padding: "0",
    boxSizing: "border-box",
    backgroundColor: "transparent",
  },
} satisfies Record<string, CSSProperties>;

export function getIntakeHeaderStyle(isVisible: boolean): CSSProperties {
  return {
    ...intakeContainerStyles.header,
    display: isVisible ? "flex" : "none",
  };
}

export function getIntakeSlotStyle(isVisible: boolean): CSSProperties {
  return {
    ...intakeContainerStyles.slot,
    display: isVisible ? "flex" : "none",
  };
}
