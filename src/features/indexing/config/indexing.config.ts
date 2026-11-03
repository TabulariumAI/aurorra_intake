export const PAGE_PROGRESS_STAGES = [
  "Refining document",
  "Recognizing document",
  "Identifying document",
  "Indexing document",
] as const;

export const ENRICHMENT_STEPS = [
  ["ExecutionEnrichment", "Verifying signatures and seals"],
  ["LegalEnrichment", "Enriching legal descriptions"],
  ["PartyEnrichment", "Enriching party information"],
] as const;
