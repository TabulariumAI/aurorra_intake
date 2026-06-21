import { clearMemoryStorage } from "./storageAdapters";
import { storeApi, type StoreState } from "../state/store";
import {
  LOCAL_STATE_KEYS,
  MEMORY_STATE_KEYS,
  SESSION_STATE_KEYS,
  type StateKey,
  type StoredInformation,
  type StoreValues,
} from "../type/store.types";

function omitActions(state: StoreState): StoreValues {
  const {
    setValue,
    resetValue,
    resetMemoryState,
    resetSessionState,
    resetLocalState,
    resetAllState,
    ...values
  } = state;

  return values;
}

function pickStateSlice(state: StoreState, keys: readonly StateKey[]): Partial<StoreValues> {
  return Object.fromEntries(keys.map((key) => [key, state[key]])) as Partial<StoreValues>;
}

export function getStoredInformation(): StoredInformation {
  const state = storeApi.getState();
  return {
    currentState: omitActions(state),
    memoryState: pickStateSlice(state, MEMORY_STATE_KEYS),
    sessionState: pickStateSlice(state, SESSION_STATE_KEYS),
    localState: pickStateSlice(state, LOCAL_STATE_KEYS),
  };
}

export function clearStorage(): void {
  storeApi.getState().resetAllState();
  clearMemoryStorage();
}

export function createStoreAdapter() {
  return {
    clearStorage,
    getStoredInformation,
    get<Key extends StateKey>(key: Key): StoreValues[Key] {
      return storeApi.getState()[key];
    },
    set<Key extends StateKey>(key: Key, value: StoreValues[Key]): void {
      storeApi.getState().setValue(key, value);
    },
    reset(key: StateKey): void {
      storeApi.getState().resetValue(key);
    },
  };
}

export type StoreAdapter = ReturnType<typeof createStoreAdapter>;

export function setRuntimeAuthToken(authToken: string | null | undefined): void {
  storeApi.getState().setValue("userToken", authToken ? { token: authToken } : null);
}
