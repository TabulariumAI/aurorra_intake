import type { StoreAdapter } from "../../../store/type/store.types";

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
};

export type WorkflowSettingName = "Review" | "Redact" | "Manifest" | "Record" | "Abstract";

export type WorkflowSetting = {
  name: WorkflowSettingName;
  label: string;
  value: boolean;
};

export type WorkflowSettings = WorkflowSetting[];

export type ChoiceValue = {
  service: string;
  level: number;
};

export type ChoiceResult = {
  choices: ChoiceValue[];
  workflow: WorkflowSettings;
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
};

export type ChoicesEvents = {
  showChoices: unknown;
  updateChoices: { name?: string } | unknown;
};

export type ChoicesRuntime = {
  store: StoreAdapter;
  eventBus: ChoicesEventBus;
  events: ChoicesEvents;
  dataWorkerClient: ChoicesWorkerClient;
};

export type SessionDataLoadRuntime = Pick<ChoicesRuntime, "dataWorkerClient" | "store">;

export type ChoicesSaveResult = {
  choices: ChoiceValue[];
  workflow: WorkflowSettings;
  changed: boolean;
};

export type ChoiceFormViewOptions = {
  disabledGroups?: string[];
};

export type ChoiceFormSubmitPayload = {
  choices: ChoiceValue[];
  workflow: WorkflowSettings;
};

export type ChoiceFormProps = {
  structure: ChoiceStructure;
  initialChoices: unknown;
  initialWorkflow: WorkflowSettings;
  choicesEditable: boolean;
  disabledGroups?: string[];
  onSave(payload: ChoiceFormSubmitPayload): void;
  onCancel(): void;
};

export type ChoicesPanelProps = ChoiceFormProps;
