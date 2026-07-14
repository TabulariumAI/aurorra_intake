import type { StoreAdapter } from "../../../store/type/store.types";
import type { JobEventCallback } from "../../job/type/job.types";

export type ChoiceOption = {
  level: string;
  description: string;
};

export type ChoiceItem = {
  name: string;
  label: string;
  dependency: string;
  default: boolean;
  system?: boolean;
};

export type ChoiceGroup = {
  name: string;
  label?: string;
  default?: string | boolean;
  dependency?: string;
  options?: ChoiceOption[];
  items?: ChoiceItem[];
  system?: boolean;
};

export type ChoiceStructure = {
  choices: ChoiceGroup[];
  workflow?: {
    alwaysReview?: boolean;
    autoRefine?: boolean;
  };
};

export type ChoiceValue = {
  service: string;
  level: number;
};

export type ChoiceWorkflow = {
  alwaysReview: boolean;
  autoRefine: boolean;
};

export type ChoiceResult = {
  choices: ChoiceValue[];
  workflow: ChoiceWorkflow;
};

export type ChoicesBackendData = {
  items?: unknown[];
} | unknown[] | null;

export type ChoicesWorkerConfig = {
  apiBaseUrl: string;
};

export type ChoicesWorkerCommand = {
  type: "load";
  token: string;
  session: string;
  config: ChoicesWorkerConfig;
};

export type ChoicesWorkerSuccess<T> = {
  ok: true;
  data: T;
};

export type ChoicesWorkerFailure = {
  ok: false;
  error: string;
  code?: string;
  status?: number;
  details?: unknown;
};

export type ChoicesWorkerResult<T> = ChoicesWorkerSuccess<T> | ChoicesWorkerFailure;

export type ChoicesWorkerClient = {
  load(token: string, session: string): Promise<ChoicesBackendData>;
};

export type ChoicesEventBus = {
  emit(eventConfig: unknown, payload?: Record<string, unknown>): void;
  listen(eventConfig: unknown, handler: (...args: unknown[]) => unknown): void;
};

export type ChoicesEvents = {
  showChoices: unknown;
  updateChoices: { name?: string } | unknown;
  toggleLayout: unknown;
};

export type ChoicesRuntime = {
  store: StoreAdapter;
  eventBus: ChoicesEventBus;
  events: ChoicesEvents;
  dialogHost: HTMLElement;
  createDialogFrame(host: HTMLElement, onClose: () => void): ChoicesDialogFrame;
  choicesWorkerClient: ChoicesWorkerClient;
  onJobEvent?: JobEventCallback;
};

export type ChoicesDialogFrame = {
  open(): HTMLElement | null;
  close(): void;
};

export type ChoicesSaveResult = {
  choices: ChoiceValue[];
  alwaysReview: boolean;
  studioModeEnabled: boolean;
  changed: boolean;
};

export type ChoiceFormViewOptions = {
  disabledGroups?: string[];
  studioModeDisabled?: boolean;
  studioModeEnabled?: boolean;
};

export type ChoiceFormSubmitPayload = {
  choices: ChoiceValue[];
  alwaysReview: boolean;
  studioModeEnabled: boolean;
};

export type ChoiceFormProps = {
  structure: ChoiceStructure;
  initialChoices: unknown;
  initialAlwaysReview: boolean;
  initialStudioModeEnabled: boolean;
  disabledGroups?: string[];
  studioModeDisabled?: boolean;
  onSave(payload: ChoiceFormSubmitPayload): void;
  onCancel(): void;
  onClose(): void;
};
