import { flushSync } from "react-dom";
import { useMemo, useState } from "react";
import { createProvisionService } from "../service/ProvisionService";
import type { ProvisionRuntime, ProvisionState } from "../type/provision.types";

export function useProvisionService(runtime: ProvisionRuntime) {
  const [state, setState] = useState<ProvisionState>({
    isProcessing: false,
    lastError: null,
  });

  const setServiceState = (nextState: ProvisionState) => {
    flushSync(() => {
      setState(nextState);
    });
  };

  const actions = useMemo(() => createProvisionService(runtime, {
    setState: setServiceState,
  }), [runtime]);

  return {
    state,
    actions,
  };
}
