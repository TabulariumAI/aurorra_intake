import type { CSSProperties } from "react";

export const intakeContainerStyles = {
  shell: {
    display: "flex",
    flexDirection: "column",
    flex: "1 1 auto",
    width: "100%",
    height: "100%",
    minHeight: "0",
    overflow: "hidden",
    textAlign: "center",
    boxSizing: "border-box",
    position: "relative",
  },
  slot: {
    flexDirection: "column",
    justifyContent: "flex-start",
    alignItems: "center",
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

export function getIntakeSlotStyle(isVisible: boolean): CSSProperties {
  return {
    ...intakeContainerStyles.slot,
    display: isVisible ? "flex" : "none",
  };
}
