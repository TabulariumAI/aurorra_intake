import { workflowValue } from "../../features/choices/service/choicesData";
import { storeApi, useStore, type StoreState } from "./store";

export type IntakeState = Readonly<{
  session: string | null;
  settingsOpen: boolean;
  canRecord: boolean;
  canRedact: boolean;
  canManifest: boolean;
}>;

function selectIntakeState(state: StoreState): IntakeState {
  return {
    session: typeof state.session === "string" ? state.session : null,
    settingsOpen: state.settingsOpen,
    canRecord: workflowValue(state.workflow, "Record"),
    canRedact: workflowValue(state.workflow, "Redact"),
    canManifest: workflowValue(state.workflow, "Manifest"),
  };
}

export function getIntakeState(): IntakeState {
  return selectIntakeState(storeApi.getState());
}

export function useIntakeState<Value>(selector: (state: IntakeState) => Value): Value {
  return useStore(state => selector(selectIntakeState(state)));
}

export const intakeActions = {
  openSettings: storeApi.getState().openSettings,
  closeSettings: storeApi.getState().closeSettings,
  requestSession: storeApi.getState().requestSession,
  resetSelection: storeApi.getState().resetSelection,
  resetSession: storeApi.getState().resetSessionState,
  clearSession(preserveSettings: boolean): void {
    const state = storeApi.getState();
    state.resetActiveSession();
    if (preserveSettings) {
      state.resetValue("isSessionInProcess");
      state.resetValue("uploadingStepStatus");
      state.resetValue("provisionStepStatus");
      state.resetValue("indexingStepStatus");
      state.resetValue("sessionRequest");
    } else {
      state.resetMemoryState();
    }
    state.resetSelection();
  },
};
