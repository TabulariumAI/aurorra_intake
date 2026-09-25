export const PAGE_PROGRESS_STAGES = [
  "Refining document",
  "Recognizing document",
  "Identifying document",
  "Indexing document",
] as const;

export const ENRICHMENT_STEPS = [
  ["LegalEnrichment", "Enriching legal descriptions"],
  ["PartyEnrichment", "Enriching party information"],
  ["Validation", "Validating document data"],
] as const;
