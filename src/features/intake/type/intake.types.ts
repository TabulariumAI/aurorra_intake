import type { PageScope } from "aurora-core";
import type { ReactNode, Ref } from "react";

export type IntakeContainerName = "select" | "progress";

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
  selectPanelRef?: Ref<HTMLElement>;
};

export type IntakeCalloutProps = {
  anchor: HTMLElement;
  children: ReactNode;
  onClose(): void;
};

export type IntakeCalloutRenderer = (props: IntakeCalloutProps) => ReactNode;

export type IntakeConfig = {
  review: boolean;
  iq: boolean;
  document: boolean;
  choices: readonly { service: string; level: number }[];
  jurisdiction: string | null;
  scope: PageScope | null;
};
