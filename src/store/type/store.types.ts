export type StoreValues = {
  isSessionInProcess: boolean;
  uploadingStepStatus: boolean;
  documentSelected: boolean;
  provisionStepStatus: boolean;
  indexingStepStatus: boolean;
  userToken: unknown;
  session: unknown;
  sasToken: unknown;
  baseUrl: unknown;
  document: unknown;
  numOfPages: unknown;
  indexChoices: unknown;
  workflow: unknown;
};

export type StateKey = keyof StoreValues;

export const MEMORY_STATE_KEYS = [
  "isSessionInProcess",
  "uploadingStepStatus",
  "provisionStepStatus",
  "indexingStepStatus",
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
