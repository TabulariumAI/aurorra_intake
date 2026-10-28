import type { IntakeConfig } from "../features/intake/type/intake.types";

export const intakeConfig: IntakeConfig = {
  review: false, iq: true, document: false, jurisdiction: null, scope: null,
  choices: [
    { service: "Recognition", level: 5 },
    { service: "ConfidentialIndexing", level: 1 },
    { service: "TransactionIndexing", level: 1 },
    { service: "EndorsementIndexing", level: 1 },
    { service: "PartyClauseIndexing", level: 1 },
    { service: "RecitalIndexing", level: 1 },
    { service: "ExhibitIndexing", level: 1 },
    { service: "MonetaryInfoIndexing", level: 0 },
    { service: "AcknowledgmentIndexing", level: 1 },
    { service: "CourtIndexing", level: 0 },
    { service: "VitalIndexing", level: 0 },
    { service: "LegalEnrichment", level: 1 },
    { service: "PartyEnrichment", level: 1 },
    { service: "ChainEnrichment", level: 0 },
    { service: "HistoryEnrichment", level: 0 },
    { service: "FeeComputation", level: 0 },
    { service: "Validation", level: 1 },
    { service: "Redact", level: 0 },
    { service: "Manifest", level: 0 },
    { service: "Record", level: 0 },
    { service: "Abstract", level: 0 },
  ],
};
