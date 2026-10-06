# Weasel native preview

The renderer follows the Windows layout behavior from Weasel revision
`d73f6295e8252ed2f7b9c12bae32e9001b1afdaa` (2026-08-18).  The preview keeps
the same public style aliases and spacing constraints as `RimeWithWeasel.cpp`
and the `WeaselUI` layout classes, then renders the off-screen surface with
DirectWrite and Direct2D.  It does not create an input method window.

The C ABI in `wss_preview.h` is intentionally small so the Rust/Tauri layer
can own JSON and PNG conversion.  If DirectWrite cannot initialize, the
renderer reports a warning and uses its GDI compatibility path; the browser
component still has its CSS fallback for non-Windows development builds.

Weasel is distributed under GPL-3.0.  This adapter is part of the same GPL
application and keeps the upstream revision here for reproducible builds.
