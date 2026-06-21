import { useMemo, useState } from "react";
import { createUploadService } from "../service/UploadService";
import type { UploadRuntime, UploadState } from "../type/upload.types";

export function useUploadService(runtime: UploadRuntime) {
  const [state, setState] = useState<UploadState>({ isProcessing: false, lastError: null });

  const actions = useMemo(() => createUploadService(runtime, {
    setState,
  }), [runtime]);

  return {
    state,
    actions,
  };
}
