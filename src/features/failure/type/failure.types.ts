import type { SessionWorkerClient } from "../../session/type/session.types";

export type FailedSessionProps = {
  onDownload: SessionWorkerClient["downloadSource"];
  formatError(error: unknown): string;
  session: string;
  error: string;
  choices: {
    source?: string | null;
    jurisdiction: string | null;
    items: readonly { service: string; level: number }[];
  } | null;
  sasToken: string | null;
  loading: boolean;
  loadError: string | null;
};
