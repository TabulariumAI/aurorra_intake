export type IntakeAlertMessage = {
  code: string;
  args?: Record<string, string>;
};

export type IntakeAlertMessages = Record<string, IntakeAlertMessage> & {
  DOC_START_NO_DOCUMENT: IntakeAlertMessage;
  INV_FILE_FMT: IntakeAlertMessage;
  TIFF_NOT_VALID: IntakeAlertMessage;
  UPLOAD_TOKEN_MISSING: IntakeAlertMessage;
  UPLOAD_BASEURL_MISSING: IntakeAlertMessage;
  UPLOAD_DOCNAME_MISSING: IntakeAlertMessage;
  DOCUMENT_MISSING: IntakeAlertMessage;
  SESSION_MISSING: IntakeAlertMessage;
  SESSION_REQ_INFO: IntakeAlertMessage;
  ERR_ACT: { code: string; args: { action: string } };
};

export const intakeMessages: IntakeAlertMessages = {
  DOC_START_NO_DOCUMENT: { code: "Select a document to start." },
  INV_FILE_FMT: { code: "Only PDF and TIFF documents are supported." },
  TIFF_NOT_VALID: { code: "The selected TIFF document is not valid." },
  UPLOAD_TOKEN_MISSING: { code: "Upload token is missing." },
  UPLOAD_BASEURL_MISSING: { code: "Upload URL is missing." },
  UPLOAD_DOCNAME_MISSING: { code: "Document name is missing." },
  DOCUMENT_MISSING: { code: "Document is missing." },
  SESSION_MISSING: { code: "Session is missing." },
  SESSION_REQ_INFO: { code: "Session information is required." },
  ERR_ACT: {
    code: "An error occurred while {action}.",
    args: { action: "action" },
  },
};

export const intakeAlert = {
  format(message: string | IntakeAlertMessage | null | undefined, args?: Record<string, string>): string {
    const code = typeof message === "object" && message && "code" in message ? String(message.code) : String(message ?? "");

    return Object.entries(args ?? {}).reduce((formatted, [key, value]) => {
      return formatted.replaceAll(`{${key}}`, String(value));
    }, code);
  },
};
