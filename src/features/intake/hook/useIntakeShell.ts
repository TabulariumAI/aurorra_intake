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
  overlay: {
    isVisible: false,
  },
  progress: {
    isProcessing: false,
    messages: null,
  },
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

  const showOverlay = useCallback(() => {
    setState((current) => ({
      ...current,
      overlay: {
        isVisible: true,
      },
    }));
  }, []);

  const hideOverlay = useCallback(() => {
    setState((current) => ({
      ...current,
      overlay: {
        isVisible: false,
      },
    }));
  }, []);

  const startProcessing = useCallback(() => {
    setState((current) => ({
      ...current,
      progress: {
        isProcessing: true,
        messages: null,
      },
    }));
  }, []);

  const endProcessing = useCallback(() => {
    setState((current) => ({
      ...current,
      progress: {
        isProcessing: false,
        messages: null,
      },
    }));
  }, []);

  const notify = useCallback((message: string) => {
    setState((current) => ({
      ...current,
      progress: {
        ...current.progress,
        messages: current.progress.messages
          ? [...current.progress.messages, message]
          : [message],
      },
    }));
  }, []);

  const actions = useMemo(() => ({
    showSelect,
    showProvision,
    clearHeader,
    progress: {
      showOverlay,
      hideOverlay,
      startProcessing,
      endProcessing,
      notify,
    },
  }), [
    clearHeader,
    endProcessing,
    hideOverlay,
    notify,
    showOverlay,
    showProvision,
    showSelect,
    startProcessing,
  ]);

  return {
    state,
    actions,
  };
}
