use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RgbaColor {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    #[serde(default = "default_alpha")]
    pub a: u8,
}

#[allow(dead_code)]
fn default_alpha() -> u8 { 255 }

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PreviewScheme {
    #[serde(rename = "colorFormat", default)]
    pub color_format: String,
    #[serde(default)]
    pub colors: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PreviewCandidate {
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub comment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PreeditInput {
    #[serde(default)]
    pub text: String,
    #[serde(rename = "highlightStart", default)]
    pub highlight_start: usize,
    #[serde(rename = "highlightEnd", default)]
    pub highlight_end: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PreviewRequest {
    #[serde(default)]
    pub style: serde_json::Value,
    #[serde(default)]
    pub scheme: PreviewScheme,
    #[serde(default)]
    pub candidates: Vec<PreviewCandidate>,
    #[serde(rename = "selectedCandidate", default)]
    pub selected_candidate: usize,
    #[serde(default)]
    pub preedit: PreeditInput,
    #[serde(default = "default_dpi")]
    pub dpi: u32,
    #[serde(default)]
    pub stage: String,
}

fn default_dpi() -> u32 { 96 }

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PreviewRegion {
    pub id: String,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PreviewResponse {
    pub renderer: String,
    #[serde(rename = "pngBase64")]
    pub png_base64: String,
    pub width: u32,
    pub height: u32,
    pub regions: Vec<PreviewRegion>,
    pub warnings: Vec<String>,
}

#[tauri::command]
pub fn render_weasel_preview(request: PreviewRequest) -> Result<PreviewResponse, String> {
    #[cfg(windows)]
    {
        return crate::preview_native::render(request);
    }

    #[cfg(not(windows))]
    {
        let _ = request;
        Ok(PreviewResponse {
            renderer: "fallback".into(),
            warnings: vec!["Windows 原生预览只在 Tauri Windows 构建中可用".into()],
            ..Default::default()
        })
    }
}
