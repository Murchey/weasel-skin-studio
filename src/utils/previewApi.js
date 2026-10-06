/** Native preview bridge. The browser build intentionally falls back to the
 * existing CSS renderer; Tauri/Windows uses the DirectWrite command. */
export async function renderNativePreview(request) {
  if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) {
    throw new Error('native preview is unavailable outside Tauri')
  }
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke('render_weasel_preview', { request })
}

export function previewDpi() {
  const ratio = Number(window?.devicePixelRatio || 1)
  return Math.max(96, Math.round(ratio * 96))
}
