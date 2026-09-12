export const PAGE_SERVICES = [
  "ConfidentialIndexing",
  "TransactionIndexing",
  "EndorsementIndexing",
  "PartyClauseIndexing",
  "RecitalIndexing",
  "ExhibitIndexing",
  "MonetaryInfoIndexing",
  "AcknowledgmentIndexing",
  "CourtIndexing",
  "VitalIndexing",
] as const;

export const PAGE_PROGRESS_STAGES = [
  "Identifying document",
  "Indexing document",
] as const;

export const ENRICHMENT_STEPS = [
  ["LegalEnrichment", "Enriching legal descriptions"],
  ["PartyEnrichment", "Enriching party information"],
  ["Validation", "Validating document data"],
] as const;
