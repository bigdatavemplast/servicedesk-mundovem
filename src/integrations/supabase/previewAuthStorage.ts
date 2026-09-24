// Supabase auth storage for standalone deployments.
// Lovable preview-session brokering is intentionally not used.
export function brokeredPreviewStorage() {
  if (typeof window === "undefined") return undefined;
  return localStorage;
}
