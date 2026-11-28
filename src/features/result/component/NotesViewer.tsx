import type { MetadataPayload } from "aurora-core";
import type { IntakeResult } from "../type/result.types";

type Note = { segment: string; message: string };

function notesWithSegments(value: IntakeResult["iq"]): Note[] {
  const data = value.data;
  if (value.status !== "success" || data === null || typeof data !== "object") return [];

  const notes = (data as { notes?: unknown }).notes;
  if (!Array.isArray(notes)) return [];

  return notes.filter((note): note is Note =>
    typeof note === "object" && note !== null &&
    typeof (note as { segment?: unknown }).segment === "string" &&
    Boolean((note as { segment: string }).segment.trim()) &&
    typeof (note as { message?: unknown }).message === "string" &&
    Boolean((note as { message: string }).message.trim()),
  ).map(note => ({ segment: note.segment.trim(), message: note.message.trim() })).reverse();
}

export function NotesViewer({ metadata, iq }: Pick<IntakeResult, "metadata" | "iq">) {
  const notes = notesWithSegments(iq);
  const title = (metadata.data as MetadataPayload | null)?.heading?.title?.trim();
  if (notes.length === 0) return null;

  return (
    <section aria-label="Review notes" style={{ borderTop: "1px solid var(--border-subtle)", minWidth: 0, paddingTop: "1rem" }}>
      {title ? <h3 style={{ color: "var(--title-ink)", fontSize: "0.95rem", fontWeight: 600, margin: "0 0 0.35rem" }}>{title}</h3> : null}
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {notes.map((note, index) => (
          <li key={`${note.segment}-${index}`} style={{ margin: "0.75rem 0" }}>
            <div style={{ color: "var(--body-ink)", fontSize: "0.8rem", fontWeight: 600, textTransform: "capitalize" }}>{note.segment}</div>
            <p style={{ color: "var(--body-ink)", lineHeight: 1.5, margin: "0.15rem 0 0" }}>{note.message}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
