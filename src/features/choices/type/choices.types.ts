import type { StoreAdapter } from "../../../store/type/store.types";
import type { PageScope } from "aurora-core";

export type ChoiceOption = {
  level: string;
  description: string;
  scope?: PageScope;
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

export type SessionChoices = {
  items: ChoiceValue[];
  jurisdiction: string | null;
};

export type ChoicesBackendData = {
  items?: unknown[];
  jurisdiction?: string | null;
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

export type ChoicesRuntime = {
  store: StoreAdapter;
};

export type SessionDataLoadRuntime = {
  authToken: string;
  dataWorkerClient: ChoicesWorkerClient;
};

export type ChoicesSaveResult = ChoiceFormSubmitPayload & { changed: boolean };

export type ChoiceFormViewOptions = {
  disabledGroups?: string[];
};

export type ChoiceFormSubmitPayload = {
  jurisdiction: string | null;
  choices: ChoiceValue[];
  workflow: WorkflowSettings;
};

export type ChoiceFormProps = {
  initialJurisdiction: string | null;
  structure: ChoiceStructure;
  initialChoices: unknown;
  initialWorkflow: WorkflowSettings;
  choicesEditable: boolean;
  disabledGroups?: string[];
  onSave(payload: ChoiceFormSubmitPayload): void;
  onCancel(): void;
};

export type ChoicesPanelProps = {
  choicesEditable: boolean;
  disabledGroups?: string[];
  onSave(choices: ChoiceValue[]): void;
  onCancel?(): void;
};
