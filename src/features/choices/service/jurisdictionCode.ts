import { JURISDICTIONS } from "../config/jurisdictions";

const STATES: Readonly<Record<string, string>> = {
  Alabama: "al", Alaska: "ak", Arizona: "az", Arkansas: "ar", California: "ca", Colorado: "co", Connecticut: "ct", Delaware: "de", Florida: "fl", Georgia: "ga", Hawaii: "hi", Idaho: "id", Illinois: "il", Indiana: "in", Iowa: "ia", Kansas: "ks", Kentucky: "ky", Louisiana: "la", Maine: "me", Maryland: "md", Massachusetts: "ma", Michigan: "mi", Minnesota: "mn", Mississippi: "ms", Missouri: "mo", Montana: "mt", Nebraska: "ne", Nevada: "nv", "New Hampshire": "nh", "New Jersey": "nj", "New Mexico": "nm", "New York": "ny", "North Carolina": "nc", "North Dakota": "nd", Ohio: "oh", Oklahoma: "ok", Oregon: "or", Pennsylvania: "pa", "Rhode Island": "ri", "South Carolina": "sc", "South Dakota": "sd", Tennessee: "tn", Texas: "tx", Utah: "ut", Vermont: "vt", Virginia: "va", Washington: "wa", "West Virginia": "wv", Wisconsin: "wi", Wyoming: "wy",
};

export function jurisdictionCode(value: string | null): string {
  if (!value) throw new Error("Every session must have a jurisdiction. Correct its Choices before submitting.");
  const [state, county] = value.split(", ");
  if (!STATES[state] || !JURISDICTIONS[state]?.includes(county)) throw new Error("Invalid jurisdiction. Correct its Choices before submitting.");
  return county.replace(/ County$/, "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).join("_") + "_" + STATES[state];
}
