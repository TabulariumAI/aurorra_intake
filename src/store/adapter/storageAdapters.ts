import { createJSONStorage, type StateStorage } from "zustand/middleware";

const memoryStorage = new Map<string, string>();

function safeStorage(getStorage: () => Storage | undefined): StateStorage {
  return {
    getItem(name) {
      try {
        return getStorage()?.getItem(name) ?? null;
      } catch {
        return null;
      }
    },
    setItem(name, value) {
      try {
        getStorage()?.setItem(name, value);
      } catch {
        return undefined;
      }
    },
    removeItem(name) {
      try {
        getStorage()?.removeItem(name);
      } catch {
        return undefined;
      }
    },
  };
}

const safeMemoryStorage: StateStorage = {
  getItem(name) {
    try {
      return memoryStorage.get(name) ?? null;
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    try {
      memoryStorage.set(name, value);
    } catch {
      return undefined;
    }
  },
  removeItem(name) {
    try {
      memoryStorage.delete(name);
    } catch {
      return undefined;
    }
  },
};

export function clearMemoryStorage(): void {
  memoryStorage.clear();
}

export const sessionJsonStorage = createJSONStorage(() =>
  safeStorage(() => (typeof window === "undefined" ? undefined : window.sessionStorage)),
)!;

export const localJsonStorage = createJSONStorage(() =>
  safeStorage(() => (typeof window === "undefined" ? undefined : window.localStorage)),
)!;

export const memoryJsonStorage = createJSONStorage(() => safeMemoryStorage)!;
