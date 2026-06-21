import { useMemo, useState } from "react";
import { createSessionService } from "../service/SessionService";
import type { SessionRuntime, SessionState } from "../type/session.types";

export function useSessionService(runtime: SessionRuntime) {
  const [state, setState] = useState<SessionState>({ isProcessing: false, lastError: null });

  const actions = useMemo(() => createSessionService(runtime, {
    setState,
  }), [runtime]);

  return {
    state,
    actions,
  };
}
