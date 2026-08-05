export type StoreValues = {
  choicesOpen: boolean;
  isSessionInProcess: boolean;
  uploadingStepStatus: boolean;
  documentSelected: boolean;
  provisionStepStatus: boolean;
  provisionRequest: IntakeProvisionRequest | null;
  indexingStepStatus: boolean;
  userToken: unknown;
  session: unknown;
  sasToken: unknown;
  baseUrl: unknown;
  document: unknown;
  numOfPages: unknown;
  indexChoices: unknown;
  selectionResetVersion: number;
  sessionRequest: IntakeSessionRequest | null;
  workflow: unknown;
};

export type IntakeProvisionRequest = { document: string; id: number };
export type IntakeSessionRequest = { id: number; session: string };

export type StateKey = keyof StoreValues;

export const MEMORY_STATE_KEYS = [
  "choicesOpen",
  "isSessionInProcess",
  "uploadingStepStatus",
  "provisionStepStatus",
  "provisionRequest",
  "indexingStepStatus",
  "selectionResetVersion",
  "sessionRequest",
] as const satisfies readonly StateKey[];

export const SESSION_STATE_KEYS = [
  "documentSelected",
  "session",
  "sasToken",
  "baseUrl",
  "document",
  "numOfPages",
] as const satisfies readonly StateKey[];

export const LOCAL_STATE_KEYS = [
  "userToken",
  "indexChoices",
  "workflow",
] as const satisfies readonly StateKey[];

export type StoredInformation = {
  currentState: StoreValues;
  memoryState: Partial<StoreValues>;
  sessionState: Partial<StoreValues>;
  localState: Partial<StoreValues>;
};

export type StoreAdapter = {
  clearStorage(): void;
  getStoredInformation(): StoredInformation;
  get<Key extends StateKey>(key: Key): StoreValues[Key];
  set<Key extends StateKey>(key: Key, value: StoreValues[Key]): void;
  reset(key: StateKey): void;
};
