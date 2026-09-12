import type { ReactNode, Ref } from "react";

export type IntakeContainerName = "select" | "progress" | "settings";

export type IntakeContainerState = {
  panel: IntakeContainerName;
  helper: string;
};

export type IntakeContainerActions = {
  showSelect(helper: string): void;
  showProgress(): void;
};

export type IntakeItemProps = {
  active: boolean;
  children: ReactNode;
  helper: string;
};

export type IntakeItemRenderer = (props: IntakeItemProps) => ReactNode;

export type IntakeContainerProps = Pick<IntakeContainerState, "panel"> & {
  select: ReactNode;
  progress: ReactNode;
  settings: ReactNode;
  selectPanelRef?: Ref<HTMLElement>;
};
