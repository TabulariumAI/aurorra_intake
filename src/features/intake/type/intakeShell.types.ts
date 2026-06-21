import type { IntakeContainerActions, IntakeContainerState } from "./intake.types";
import type { ProgressOverlayState } from "./progress.types";

export type IntakeProgressState = {
  isProcessing: boolean;
  messages: string[] | null;
};

export type IntakeShellState = {
  container: IntakeContainerState;
  overlay: ProgressOverlayState;
  progress: IntakeProgressState;
};

export type IntakeProgressActions = {
  showOverlay(): void;
  hideOverlay(): void;
  startProcessing(): void;
  endProcessing(): void;
  notify(message: string): void;
};

export type IntakeShellActions = IntakeContainerActions & {
  progress: IntakeProgressActions;
};

export type IntakeShell = {
  state: IntakeShellState;
  actions: IntakeShellActions;
};
