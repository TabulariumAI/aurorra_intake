import type { IntakeContainerActions, IntakeContainerState } from "./intake.types";

export type IntakeShellState = {
  container: IntakeContainerState;
};

export type IntakeShellActions = IntakeContainerActions;

export type IntakeShell = {
  state: IntakeShellState;
  actions: IntakeShellActions;
};
