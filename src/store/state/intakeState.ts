import { storeApi, useStore, type StoreState } from "./store";

export type IntakeState = Readonly<{
  session: string | null;
}>;

function selectIntakeState(state: StoreState): IntakeState {
  return {
    session: typeof state.session === "string" ? state.session : null,
  };
}

export function getIntakeState(): IntakeState {
  return selectIntakeState(storeApi.getState());
}

export function useIntakeState<Value>(selector: (state: IntakeState) => Value): Value {
  return useStore(state => selector(selectIntakeState(state)));
}

export const intakeActions = {
  requestSession: storeApi.getState().requestSession,
  resetSelection: storeApi.getState().resetSelection,
  resetSession: storeApi.getState().resetSessionState,
  clearSession(): void {
    const state = storeApi.getState();
    state.resetActiveSession();
    state.resetMemoryState();
    state.resetSelection();
  },
};
