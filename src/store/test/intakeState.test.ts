import { beforeEach, expect, it } from "vitest";
import { intakeActions } from "../state/intakeState";
import { LOCAL_STATE_STORAGE_KEY, SESSION_STATE_STORAGE_KEY, storeApi } from "../state/store";

beforeEach(() => storeApi.getState().resetAllState());

it.each(["resetMemoryState", "resetAllState"] as const)("keeps selection resets increasing across %s", (reset) => {
  intakeActions.resetSelection();
  let version = storeApi.getState().selectionResetVersion;
  for (let attempt = 0; attempt < 3; attempt++) {
    storeApi.getState()[reset]();
    intakeActions.resetSelection();
    expect(storeApi.getState().selectionResetVersion).toBeGreaterThan(version);
    version = storeApi.getState().selectionResetVersion;
  }
});

it.each([false, true])("resets selection on every clearSession(%s) while retaining its settings contract", (preserveSettings) => {
  intakeActions.resetSelection();
  let version = storeApi.getState().selectionResetVersion;
  for (let attempt = 0; attempt < 3; attempt++) {
    storeApi.setState({
      documentSelected: true, session: "session-1", document: "document.pdf",
      baseUrl: "https://storage.example.test", sasToken: "test-token", numOfPages: 3,
      settingsOpen: true, isSessionInProcess: true, uploadingStepStatus: true,
      provisionStepStatus: true, indexingStepStatus: true,
      sessionRequest: { id: 1, session: "session-1" },
    });
    intakeActions.clearSession(preserveSettings);
    expect(storeApi.getState().selectionResetVersion).toBeGreaterThan(version);
    expect(storeApi.getState()).toMatchObject({
      documentSelected: false, session: null, document: null, baseUrl: null,
      sasToken: null, numOfPages: 1, settingsOpen: preserveSettings,
      isSessionInProcess: false, uploadingStepStatus: false,
      provisionStepStatus: false, indexingStepStatus: false, sessionRequest: null,
    });
    version = storeApi.getState().selectionResetVersion;
  }
});

it("does not persist selection reset versions", () => {
  intakeActions.resetSelection();
  expect(sessionStorage.getItem(SESSION_STATE_STORAGE_KEY)).toBeNull();
  expect(localStorage.getItem(LOCAL_STATE_STORAGE_KEY)).toBeNull();
});
