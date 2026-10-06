mod preview;
#[cfg(windows)]
mod preview_native;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![preview::render_weasel_preview])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
