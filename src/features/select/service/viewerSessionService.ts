export async function clearViewerSession(): Promise<void> {
  const { IndexedDbViewerSessionStore } = await import("@tabulariumai/aurora-lens");
  await new IndexedDbViewerSessionStore().delete();
}
