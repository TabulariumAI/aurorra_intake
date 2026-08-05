import type { CSSProperties } from "react";

export const choiceFormStyles = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "0.1rem",
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
    gap: "0.1rem",
    marginTop: "1.5rem",
  },
} satisfies Record<string, CSSProperties>;

