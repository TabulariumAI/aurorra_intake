import type { StoreAdapter } from "../../../store/type/store.types";
import type { JobEventCallback } from "aurorra-ui";

export type SelectAlertMessage = {
  code: string;
  args?: Record<string, string>;
};

export type SelectAlertMessages = Record<string, SelectAlertMessage> & {
  ERR_ACT: { code: string; args: { action: string } };
};

export type SelectAlert = {
  format(message: SelectAlertMessage, args?: Record<string, string>): string;
};

export type SelectEvents = {
  reRoute: { detail: { stage: string; file: string; jobId: string } };
  showChoices: unknown;
};

export type SelectEventBus = {
  emit(eventConfig: unknown, payload?: Record<string, unknown>): void;
  emitAsync(eventConfig: unknown, payload?: Record<string, unknown>): Promise<void>;
};

export type SelectRuntime = {
  alert: SelectAlert;
  messages: SelectAlertMessages;
  eventBus: SelectEventBus;
  events: SelectEvents;
  onJobEvent?: JobEventCallback;
  store: StoreAdapter;
  intervalMs: number;
};
