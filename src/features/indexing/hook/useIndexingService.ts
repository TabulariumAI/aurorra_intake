import { useMemo, useState } from "react";
import { createIndexingService } from "../service/IndexingService";
import type { IndexingRuntime, IndexingState } from "../type/indexing.types";

export function useIndexingService(runtime: IndexingRuntime) {
  const [state, setState] = useState<IndexingState>({ isProcessing: false, lastError: null });
  const actions = useMemo(() => createIndexingService(runtime, {
    setState,
  }), [runtime]);

  return {
    state,
    actions,
  };
}
