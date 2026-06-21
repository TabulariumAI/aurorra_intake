import type { ReactNode, Ref } from "react";

export type IntakeContainerName = "select" | "provision";

export type IntakeContainerState = {
  panel: IntakeContainerName;
  title: string;
  helper: string;
  error: string;
};

export type IntakeContainerActions = {
  showSelect(title: string, helper: string): void;
  showProvision(title: string, helper: string): void;
  clearHeader(): void;
  clearError(): void;
  setError(message: string): void;
};

export type IntakeContainerProps = IntakeContainerState & {
  select: ReactNode;
  provision: ReactNode;
  overlay?: ReactNode;
  selectPanelRef?: Ref<HTMLElement>;
  provisionPanelRef?: Ref<HTMLElement>;
};
