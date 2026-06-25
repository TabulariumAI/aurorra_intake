import type { CSSProperties } from "react";

const shellLayoutGapRem = 0.75;
const shellMainPanelMinRem = 42;
const shellMainPanelMaxRem = 56;
const shellFrameHeight = `calc(100vh - ${shellLayoutGapRem * 2}rem)`;

export const intakeContainerStyles = {
  shell: {
    display: "flex",
    flexDirection: "column",
    margin: "0",
    flex: `0 0 clamp(${shellMainPanelMinRem}rem, 46vw, ${shellMainPanelMaxRem}rem)`,
    width: "auto",
    maxWidth: "none",
    minWidth: `${shellMainPanelMinRem}rem`,
    height: shellFrameHeight,
    minHeight: shellFrameHeight,
    overflow: "hidden",
    verticalAlign: "top",
    textAlign: "center",
    boxSizing: "border-box",
    position: "relative",
    borderRadius: "0.45rem",
    padding: "1.55rem",
    boxShadow: "0 1.4rem 3rem rgba(15, 23, 42, 0.13), 0 0.25rem 0.8rem rgba(0, 92, 122, 0.08)",
    border: "1px solid rgba(226, 232, 240, 0.95)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,253,254,0.94)), var(--background-main)",
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
