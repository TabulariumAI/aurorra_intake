import type {
  UploadWorkerCommand,
  UploadWorkerResult,
} from "../type/upload.types";

type ErrorLike = {
  error?: unknown;
  details?: unknown;
  message?: unknown;
};

function resolveErrorMessage(error: unknown) {
  const candidate = error as ErrorLike | null | undefined;
  return typeof candidate?.error === "string"
    ? candidate.error
    : typeof candidate?.details === "string"
      ? candidate.details
      : typeof candidate?.message === "string"
        ? candidate.message
        : "An error occurred during upload.";
}

function isUploadCommand(command: unknown): command is UploadWorkerCommand {
  const candidate = command as UploadWorkerCommand | null | undefined;
  return typeof candidate?.type === "string" && candidate.type === "upload";
}

export class UploadWorker {
  async run<T>(command: UploadWorkerCommand): Promise<UploadWorkerResult<T>> {
    if (!isUploadCommand(command)) {
      return {
        ok: false,
        code: "bad_request",
        error: "Unsupported upload worker command.",
      };
    }

    if (!command.baseUrl || !command.sasToken || !command.file || !command.path) {
      return {
        ok: false,
        code: "bad_request",
        error: "Missing required parameters.",
        details: {
          baseUrl: command.baseUrl,
          sasToken: command.sasToken,
          file: command.file,
          path: command.path,
        },
      };
    }

    if (command.file.size > command.maxFileSizeBytes) {
      return {
        ok: false,
        code: "bad_request",
        error: `File size exceeds the ${command.maxFileSizeBytes / (1024 * 1024)} MB limit.`,
        details: {
          fileSize: command.file.size,
          maxSize: `${command.maxFileSizeBytes / (1024 * 1024)} MB`,
        },
      };
    }

    const uploadUrl = `${command.baseUrl}/${command.path}?${command.sasToken}`;
    const headers = {
      "Content-Type": command.file.type || "application/octet-stream",
      "x-ms-blob-type": "BlockBlob",
    };

    let response: Response;
    try {
      response = await fetch(uploadUrl, {
        method: "PUT",
        headers,
        body: command.file as BodyInit,
      });
    } catch (error) {
      return {
        ok: false,
        code: "server_error",
        error: resolveErrorMessage(error),
        details: { error },
      };
    }

    if (!response.ok) {
      const errorDetails = await response.text();
      return {
        ok: false,
        code: "upload_failed",
        status: response.status,
        error: `Upload failed with status ${response.status}: ${response.statusText}`,
        details: {
          errorDetails,
          status: response.status,
          statusText: response.statusText,
          url: uploadUrl,
        },
      };
    }

    return {
      ok: true,
      data: {
        message: "File uploaded successfully.",
        isComplete: true,
      } as T,
    };
  }
}

self.onmessage = async (event: MessageEvent<UploadWorkerCommand>) => {
  const worker = new UploadWorker();
  const result = await worker.run(event.data);
  self.postMessage(result);
};
