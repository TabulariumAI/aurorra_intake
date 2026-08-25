import { useCallback, useMemo, useState } from "react";
import type { IntakeContainerState } from "../type/intake.types";
import type { IntakeShell, IntakeShellState } from "../type/intakeShell.types";

const initialContainerState: IntakeContainerState = {
  panel: "select",
  helper: "",
};

const initialState: IntakeShellState = {
  container: initialContainerState,
};

export function useIntakeShell(): IntakeShell {
  const [state, setState] = useState<IntakeShellState>(initialState);

  const showSelect = useCallback((helper: string) => {
    setState((current) => ({
      ...current,
      container: {
        panel: "select",
        helper,
      },
    }));
  }, []);

  const showProgress = useCallback(() => {
    setState((current) => ({
      ...current,
      container: {
        panel: "progress",
        helper: "Follow each step as it completes.",
      },
    }));
  }, []);

  const actions = useMemo(() => ({
    showSelect,
    showProgress,
  }), [
    showProgress,
    showSelect,
  ]);

  return {
    state,
    actions,
  };
}
