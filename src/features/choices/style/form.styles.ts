import type { CSSProperties } from "react";

export const choiceFormStyles = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "0.1rem",
    width: "100%",
    maxWidth: "60rem",
    margin: "0 auto",
    boxSizing: "border-box",
  },
  title: {
    fontSize: "1.2rem",
    fontWeight: "bold",
    marginTop: "1rem",
    marginBottom: "1rem",
    textAlign: "center",
    userSelect: "none",
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

