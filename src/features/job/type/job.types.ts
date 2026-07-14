export type JobName =
  | "choices.load"
  | "indexing.start"
  | "indexing.status"
  | "provision.document"
  | "session.load"
  | "session.new"
  | "upload.document";

export type JobEvent = {
  job: JobName;
  jobId: string;
  message: string;
  session: string | null;
} & (
  | { phase: "started" | "completed" }
  | { error: string; phase: "failed" }
);

export type JobEventCallback = (event: JobEvent) => void;
