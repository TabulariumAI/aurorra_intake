import { create } from "zustand";
import { localJsonStorage, sessionJsonStorage } from "../adapter/storageAdapters";
import {
  LOCAL_STATE_KEYS,
  MEMORY_STATE_KEYS,
  SESSION_STATE_KEYS,
  type StateKey,
  type StoreValues,
} from "../type/store.types";

export const SESSION_STATE_STORAGE_KEY = "aurorra-intake.session-state";
export const LOCAL_STATE_STORAGE_KEY = "aurorra-intake.local-state";

export type StoreActions = {
  setValue<Key extends StateKey>(name: Key, value: StoreValues[Key]): void;
  resetValue(name: StateKey): void;
  resetMemoryState(): void;
  resetSessionState(): void;
  resetLocalState(): void;
  resetAllState(): void;
};

export type StoreState = StoreValues & StoreActions;

type JsonStorage = typeof sessionJsonStorage;

const DEFAULT_STATE: StoreValues = {
  isSessionInProcess: false,
  uploadingStepStatus: false,
  documentSelected: false,
  provisionStepStatus: false,
  indexingStepStatus: false,
  userToken: null,
  session: null,
  sasToken: null,
  baseUrl: null,
  document: null,
  numOfPages: 1,
  indexChoices: null,
  workflow: null,
};

function isValidValue(name: StateKey, value: unknown): boolean {
  return value !== undefined;
}

function cloneDefault<Key extends StateKey>(name: Key): StoreValues[Key] {
  const value = DEFAULT_STATE[name];
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as StoreValues[Key];
}

function defaultsFor(names: readonly StateKey[]): Partial<StoreValues> {
  return Object.fromEntries(names.map((name) => [name, cloneDefault(name)])) as Partial<StoreValues>;
}

function isDefaultValue(name: StateKey, value: unknown): boolean {
  try {
    return JSON.stringify(value) === JSON.stringify(DEFAULT_STATE[name]);
  } catch {
    return false;
  }
}

function persistedSlice(state: StoreState, names: readonly StateKey[]): Partial<StoreValues> {
  return Object.fromEntries(
    names
      .filter((name) => !isDefaultValue(name, state[name]))
      .map((name) => [name, state[name]]),
  ) as Partial<StoreValues>;
}

function removePersistedStore(name: string, storage: JsonStorage): void {
  try {
    storage.removeItem(name);
  } catch {
    return undefined;
  }
}

function readPersistedValues(name: string, storage: JsonStorage): Partial<StoreValues> {
  try {
    const value = storage.getItem(name);
    if (!value || typeof value !== "object" || !("state" in value)) return {};
    const state = value.state;
    return state && typeof state === "object" ? state as Partial<StoreValues> : {};
  } catch {
    return {};
  }
}

function writePersistedValues(
  name: string,
  storage: JsonStorage,
  state: StoreState,
  names: readonly StateKey[],
): void {
  try {
    const stateSlice = persistedSlice(state, names);
    if (Object.keys(stateSlice).length === 0) {
      storage.removeItem(name);
      return;
    }
    storage.setItem(name, { state: stateSlice, version: 0 });
  } catch {
    return undefined;
  }
}

function getInitialValues(): StoreValues {
  return {
    ...DEFAULT_STATE,
    ...readPersistedValues(SESSION_STATE_STORAGE_KEY, sessionJsonStorage),
    ...readPersistedValues(LOCAL_STATE_STORAGE_KEY, localJsonStorage),
  };
}

function statePatch<Key extends StateKey>(name: Key, value: StoreValues[Key]): Partial<StoreState> {
  return { [name]: value } as Partial<StoreState>;
}

export const useStore = create<StoreState>()((set, get) => ({
  ...getInitialValues(),
  setValue: (name, value) => {
    if (!isValidValue(name, value)) return;
    set(statePatch(name, value));
  },
  resetValue: (name) => set(statePatch(name, cloneDefault(name))),
  resetMemoryState: () => set(defaultsFor(MEMORY_STATE_KEYS)),
  resetSessionState: () => {
    set(defaultsFor(SESSION_STATE_KEYS));
    removePersistedStore(SESSION_STATE_STORAGE_KEY, sessionJsonStorage);
  },
  resetLocalState: () => {
    set(defaultsFor(LOCAL_STATE_KEYS));
    removePersistedStore(LOCAL_STATE_STORAGE_KEY, localJsonStorage);
  },
  resetAllState: () => {
    get().resetMemoryState();
    get().resetSessionState();
    get().resetLocalState();
  },
}));

export const storeApi = useStore;

storeApi.subscribe((state) => {
  writePersistedValues(SESSION_STATE_STORAGE_KEY, sessionJsonStorage, state, SESSION_STATE_KEYS);
  writePersistedValues(LOCAL_STATE_STORAGE_KEY, localJsonStorage, state, LOCAL_STATE_KEYS);
});
