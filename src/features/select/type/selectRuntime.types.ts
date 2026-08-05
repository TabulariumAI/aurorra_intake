import type { StoreAdapter } from "../../../store/type/store.types";
import type { JobEventCallback } from "aurorra-ui";

export type SelectEvents = {
  reRoute: { detail: { stage: string; file: string; jobId: string } };
  showChoices: unknown;
};

export type SelectEventBus = {
  emit(eventConfig: unknown, payload?: Record<string, unknown>): void;
  emitAsync(eventConfig: unknown, payload?: Record<string, unknown>): Promise<void>;
};

export type SelectRuntime = {
  eventBus: SelectEventBus;
  events: SelectEvents;
  onJobEvent?: JobEventCallback;
  store: StoreAdapter;
};
