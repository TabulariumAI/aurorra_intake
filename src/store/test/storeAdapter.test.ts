import { beforeEach, describe, expect, it } from "vitest";
import { createStoreAdapter, setRuntimeAuthToken } from "../adapter/storeAdapter";
import { clearMemoryStorage, localJsonStorage, sessionJsonStorage } from "../adapter/storageAdapters";
import {
  LOCAL_STATE_STORAGE_KEY,
  SESSION_STATE_STORAGE_KEY,
  storeApi,
} from "../state/store";

const PWA_LOCAL_STATE_STORAGE_KEY = "tabularium.local-state";

describe("storeAdapter", () => {
  beforeEach(() => {
    clearMemoryStorage();
    storeApi.getState().resetAllState();
  });

  it("sets, gets, and resets values through the adapter", () => {
    const adapter = createStoreAdapter();

    adapter.set("session", "session-1");
    adapter.set("numOfPages", 5);

    expect(adapter.get("session")).toBe("session-1");
    expect(adapter.get("numOfPages")).toBe(5);

    adapter.reset("session");

    expect(adapter.get("session")).toBeNull();
  });

  it("persists session and local slices without touching unrelated local storage", () => {
    const pwaPayload = JSON.stringify({ state: { userToken: { token: "pwa-token" } }, version: 0 });
    window.localStorage.setItem(PWA_LOCAL_STATE_STORAGE_KEY, pwaPayload);
    const adapter = createStoreAdapter();

    adapter.set("session", "session-1");
    setRuntimeAuthToken("runtime-token");

    expect(window.localStorage.getItem(PWA_LOCAL_STATE_STORAGE_KEY)).toBe(pwaPayload);
    expect(window.sessionStorage.getItem(SESSION_STATE_STORAGE_KEY)).toContain("session-1");
    expect(window.localStorage.getItem(LOCAL_STATE_STORAGE_KEY)).toContain("runtime-token");
  });

  it("retains choices by document session in browser session storage", () => {
    const adapter = createStoreAdapter();
    const choices = [{ level: 5, service: "Recognition" }];

    adapter.set("choicesBySession", { "session-1": choices });
    storeApi.getState().resetActiveSession();

    expect(adapter.get("choicesBySession")).toEqual({ "session-1": choices });
    expect(window.sessionStorage.getItem(SESSION_STATE_STORAGE_KEY)).toContain("session-1");
  });

  it("clears persisted session and local state through reset methods", () => {
    const adapter = createStoreAdapter();
    adapter.set("session", "session-1");
    setRuntimeAuthToken("runtime-token");

    storeApi.getState().resetSessionState();
    storeApi.getState().resetLocalState();

    expect(sessionJsonStorage.getItem(SESSION_STATE_STORAGE_KEY)).toBeNull();
    expect(localJsonStorage.getItem(LOCAL_STATE_STORAGE_KEY)).toBeNull();
  });
});
