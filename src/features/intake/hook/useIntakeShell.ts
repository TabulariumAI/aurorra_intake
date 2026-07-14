import { useCallback, useMemo, useState } from "react";
import type { IntakeContainerState } from "../type/intake.types";
import type { IntakeShell, IntakeShellState } from "../type/intakeShell.types";

const initialContainerState: IntakeContainerState = {
  panel: "select",
  title: "",
  helper: "",
};

const initialState: IntakeShellState = {
  container: initialContainerState,
};

export function useIntakeShell(): IntakeShell {
  const [state, setState] = useState<IntakeShellState>(initialState);

  const showSelect = useCallback((title: string, helper: string) => {
    setState((current) => ({
      ...current,
      container: {
        panel: "select",
        title,
        helper,
      },
    }));
  }, []);

  const showProvision = useCallback((title: string, helper: string) => {
    setState((current) => ({
      ...current,
      container: {
        panel: "provision",
        title,
        helper,
      },
    }));
  }, []);

  const clearHeader = useCallback(() => {
    setState((current) => ({
      ...current,
      container: {
        ...current.container,
        title: "",
        helper: "",
      },
    }));
  }, []);

  const actions = useMemo(() => ({
    showSelect,
    showProvision,
    clearHeader,
  }), [
    clearHeader,
    showProvision,
    showSelect,
  ]);

  return {
    state,
    actions,
  };
}
