import { create } from "zustand";
import type { IntakeResult, ResultActions, ResultValue } from "../type/result.types";

const empty: ResultValue = { status: "idle", data: null, error: null };
const initial = { session: null, requestId: null, metadata: empty, audit: empty, iq: empty };

type ResultStore = IntakeResult & ResultActions & {
  session: string | null;
  requestId: string | null;
};

export const useResultStore = create<ResultStore>()((set, get) => ({
  ...initial,
  begin(session) {
    const requestId = crypto.randomUUID();
    set({ ...initial, session, requestId });
    return requestId;
  },
  async load(requestId, resource, client, token) {
    const { session } = get();
    if (get().requestId !== requestId || session === null || get()[resource].status !== "idle") return;
    set({ [resource]: { status: "loading", data: null, error: null } });
    try {
      const data = await client.load(token, session, resource);
      if (get().requestId === requestId) set({ [resource]: { status: "success", data, error: null } });
    } catch (error) {
      if (get().requestId === requestId) set({ [resource]: { status: "error", data: null,
        error: error instanceof Error || error instanceof ErrorEvent ? error.message : String(error) } });
      throw error;
    }
  },
  reset() {
    set(initial);
  },
}));

export const resultStoreApi = useResultStore;
