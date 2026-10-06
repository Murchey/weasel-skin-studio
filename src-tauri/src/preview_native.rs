#![cfg(windows)]

use crate::preview::{PreviewRequest, PreviewResponse, PreviewRegion};
use base64::Engine;
use png::{BitDepth, ColorType, Encoder};
use serde_json::Value;
use std::ffi::{c_char, c_int, CStr, CString};
use std::io::Cursor;

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct WssColor { r: u8, g: u8, b: u8, a: u8 }

#[repr(C)]
struct WssCandidate { label: *const c_char, text: *const c_char, comment: *const c_char }

#[repr(C)]
struct WssPreviewInput {
    font_face: *const c_char,
    label_font_face: *const c_char,
    comment_font_face: *const c_char,
    label_format: *const c_char,
    mark_text: *const c_char,
    preedit: *const c_char,
    preedit_highlight_start: usize,
    preedit_highlight_end: usize,
    font_point: c_int,
    label_font_point: c_int,
    comment_font_point: c_int,
    layout_mode: c_int,
    inline_preedit: c_int,
    vertical_text_left_to_right: c_int,
    vertical_text_with_wrap: c_int,
    vertical_auto_reverse: c_int,
    border: c_int,
    margin_x: c_int,
    margin_y: c_int,
    spacing: c_int,
    candidate_spacing: c_int,
    hilite_spacing: c_int,
    padding_x: c_int,
    padding_y: c_int,
    shadow_radius: c_int,
    shadow_offset_x: c_int,
    shadow_offset_y: c_int,
    window_radius: c_int,
    hilite_radius: c_int,
    baseline: c_int,
    linespacing: c_int,
    antialias_mode: c_int,
    min_width: c_int,
    max_width: c_int,
    min_height: c_int,
    max_height: c_int,
    selected: c_int,
    dpi: u32,
    candidates: *const WssCandidate,
    candidate_count: usize,
    colors: [WssColor; 28],
}

#[repr(C)]
#[derive(Clone, Copy)]
struct WssRegion { id: [c_char; 64], x: f32, y: f32, width: f32, height: f32 }

#[repr(C)]
struct WssPreviewOutput {
    pixels_bgra: *mut u8,
    pixel_len: usize,
    width: c_int,
    height: c_int,
    regions: [WssRegion; 256],
    region_count: usize,
    used_directwrite: c_int,
}

extern "C" {
    fn wss_render_preview(input: *const WssPreviewInput, output: *mut WssPreviewOutput) -> c_int;
    fn wss_free_preview(output: *mut WssPreviewOutput);
}

const COLOR_KEYS: [&str; 28] = [
    "back_color", "border_color", "shadow_color", "text_color", "hilited_text_color",
    "hilited_back_color", "hilited_shadow_color", "label_color", "candidate_text_color",
    "candidate_back_color", "candidate_border_color", "candidate_shadow_color", "comment_text_color",
    "hilited_comment_text_color", "hilited_mark_color", "hilited_label_color",
    "hilited_candidate_text_color", "hilited_candidate_back_color", "hilited_candidate_border_color",
    "hilited_candidate_shadow_color", "hilited_candidate_label_color", "nextpage_color", "prevpage_color",
    "candidate_abbreviate_length", "font_point", "label_font_point", "comment_font_point", "preedit_color",
];

fn number(value: Option<&Value>, fallback: i32) -> i32 {
    value.and_then(Value::as_f64).map(|n| n.round() as i32).unwrap_or(fallback)
}

fn string(value: Option<&Value>, fallback: &str) -> CString {
    CString::new(value.and_then(Value::as_str).unwrap_or(fallback)).unwrap_or_else(|_| CString::new(fallback).unwrap())
}

fn boolean(value: Option<&Value>) -> c_int { value.and_then(Value::as_bool).unwrap_or(false) as c_int }

fn color(value: Option<&Value>, fallback: WssColor) -> WssColor {
    let Some(obj) = value.and_then(Value::as_object) else { return fallback };
    WssColor {
        r: obj.get("r").and_then(Value::as_u64).unwrap_or(fallback.r as u64) as u8,
        g: obj.get("g").and_then(Value::as_u64).unwrap_or(fallback.g as u64) as u8,
        b: obj.get("b").and_then(Value::as_u64).unwrap_or(fallback.b as u64) as u8,
        a: obj.get("a").and_then(Value::as_u64).unwrap_or(fallback.a as u64) as u8,
    }
}

fn region_id(region: &WssRegion) -> String {
    unsafe { CStr::from_ptr(region.id.as_ptr()) }.to_string_lossy().into_owned()
}

pub fn render(request: PreviewRequest) -> Result<PreviewResponse, String> {
    let style = request.style.as_object().cloned().unwrap_or_default();
    let layout = style.get("layout").and_then(Value::as_object).cloned().unwrap_or_default();
    let font_face = string(style.get("font_face"), "Segoe UI");
    let label_font_face = string(style.get("label_font_face"), font_face.to_str().unwrap_or("Segoe UI"));
    let comment_font_face = string(style.get("comment_font_face"), font_face.to_str().unwrap_or("Segoe UI"));
    let label_format = string(style.get("label_format"), "%s.");
    let mark_text = string(style.get("mark_text"), "");
    let preedit = CString::new(request.preedit.text.clone()).unwrap_or_default();
    let mode = if boolean(style.get("vertical_text")) != 0 { 2 } else if boolean(style.get("horizontal")) != 0 { 1 } else { 0 };
    let defaults = [
        WssColor { r: 255, g: 255, b: 255, a: 255 }, WssColor { r: 0, g: 0, b: 0, a: 255 }, WssColor::default(),
        WssColor { r: 32, g: 32, b: 32, a: 255 }, WssColor { r: 255, g: 255, b: 255, a: 255 }, WssColor::default(),
        WssColor::default(), WssColor { r: 100, g: 100, b: 100, a: 255 }, WssColor { r: 32, g: 32, b: 32, a: 255 },
        WssColor::default(), WssColor::default(), WssColor::default(), WssColor { r: 120, g: 120, b: 120, a: 255 },
        WssColor { r: 160, g: 160, b: 160, a: 255 }, WssColor { r: 255, g: 170, b: 0, a: 255 }, WssColor { r: 255, g: 255, b: 255, a: 255 },
        WssColor { r: 255, g: 255, b: 255, a: 255 }, WssColor { r: 32, g: 32, b: 32, a: 255 }, WssColor::default(),
        WssColor::default(), WssColor::default(), WssColor { r: 120, g: 120, b: 120, a: 255 }, WssColor { r: 120, g: 120, b: 120, a: 255 },
        WssColor::default(), WssColor::default(), WssColor::default(), WssColor::default(),
    ];
    let color_obj = request.scheme.colors.as_object();
    let mut colors = [WssColor::default(); 28];
    for (i, key) in COLOR_KEYS.iter().enumerate() {
        colors[i] = color(color_obj.and_then(|map| map.get(*key)), defaults[i]);
    }

    let mut c_strings: Vec<(CString, CString, CString)> = Vec::with_capacity(request.candidates.len());
    let mut c_candidates: Vec<WssCandidate> = Vec::with_capacity(request.candidates.len());
    for candidate in &request.candidates {
        let label = CString::new(candidate.label.clone()).unwrap_or_default();
        let text = CString::new(candidate.text.clone()).unwrap_or_default();
        let comment = CString::new(candidate.comment.clone()).unwrap_or_default();
        c_candidates.push(WssCandidate { label: label.as_ptr(), text: text.as_ptr(), comment: comment.as_ptr() });
        c_strings.push((label, text, comment));
    }

    let input = WssPreviewInput {
        font_face: font_face.as_ptr(), label_font_face: label_font_face.as_ptr(), comment_font_face: comment_font_face.as_ptr(),
        label_format: label_format.as_ptr(), mark_text: mark_text.as_ptr(), preedit: preedit.as_ptr(),
        preedit_highlight_start: request.preedit.highlight_start,
        preedit_highlight_end: request.preedit.highlight_end,
        font_point: number(style.get("font_point"), 14), label_font_point: number(style.get("label_font_point"), 14),
        comment_font_point: number(style.get("comment_font_point"), 14), layout_mode: mode,
        inline_preedit: boolean(style.get("inline_preedit")), vertical_text_left_to_right: boolean(style.get("vertical_text_left_to_right")),
        vertical_text_with_wrap: boolean(style.get("vertical_text_with_wrap")), vertical_auto_reverse: boolean(style.get("vertical_auto_reverse")), border: number(layout.get("border").or_else(|| layout.get("border_width")), 3),
        margin_x: number(layout.get("margin_x"), 12), margin_y: number(layout.get("margin_y"), 12), spacing: number(layout.get("spacing"), 10),
        candidate_spacing: number(layout.get("candidate_spacing"), 5), hilite_spacing: number(layout.get("hilite_spacing"), 4),
        padding_x: number(layout.get("hilite_padding_x").or_else(|| layout.get("hilite_padding")), 2),
        padding_y: number(layout.get("hilite_padding_y").or_else(|| layout.get("hilite_padding")), 2),
        shadow_radius: number(layout.get("shadow_radius"), 0), shadow_offset_x: number(layout.get("shadow_offset_x"), 4),
        shadow_offset_y: number(layout.get("shadow_offset_y"), 4), window_radius: number(layout.get("corner_radius"), 4),
        hilite_radius: number(layout.get("round_corner"), 4),
        baseline: number(layout.get("baseline"), 0), linespacing: number(layout.get("linespacing"), 0),
        antialias_mode: match style.get("antialias_mode").and_then(Value::as_str) {
            Some("cleartype") => 1, Some("grayscale") => 2, Some("aliased") => 3, _ => 0,
        },
        min_width: number(layout.get("min_width"), 160),
        max_width: number(layout.get("max_width"), 0), min_height: number(layout.get("min_height"), 0), max_height: number(layout.get("max_height"), 0),
        selected: request.selected_candidate.min(request.candidates.len().saturating_sub(1)) as c_int, dpi: request.dpi.max(96),
        candidates: c_candidates.as_ptr(), candidate_count: c_candidates.len(), colors,
    };

    let mut output: WssPreviewOutput = unsafe { std::mem::zeroed() };
    let ok = unsafe { wss_render_preview(&input, &mut output) };
    if ok == 0 || output.pixels_bgra.is_null() || output.width <= 0 || output.height <= 0 {
        return Ok(PreviewResponse { renderer: "fallback".into(), warnings: vec!["Windows 原生预览初始化失败，已切换到浏览器近似预览".into()], ..Default::default() });
    }

    let bgra = unsafe { std::slice::from_raw_parts(output.pixels_bgra, output.pixel_len) };
    let mut rgba = Vec::with_capacity(bgra.len());
    for px in bgra.chunks_exact(4) { rgba.extend_from_slice(&[px[2], px[1], px[0], px[3]]); }
    let mut png_bytes = Vec::new();
    {
        let mut encoder = Encoder::new(Cursor::new(&mut png_bytes), output.width as u32, output.height as u32);
        encoder.set_color(ColorType::Rgba);
        encoder.set_depth(BitDepth::Eight);
        let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
        writer.write_image_data(&rgba).map_err(|e| e.to_string())?;
    }
    let regions = (0..output.region_count.min(256)).map(|i| {
        let r = output.regions[i];
        PreviewRegion { id: region_id(&r), x: r.x, y: r.y, width: r.width, height: r.height }
    }).collect();
    let used_directwrite = output.used_directwrite != 0;
    unsafe { wss_free_preview(&mut output); }
    Ok(PreviewResponse {
        renderer: "native".into(),
        png_base64: base64::engine::general_purpose::STANDARD.encode(png_bytes),
        width: output.width as u32,
        height: output.height as u32,
        regions,
        warnings: if used_directwrite {
            Vec::new()
        } else {
            vec!["DirectWrite 不可用，当前使用 Windows GDI 兼容渲染".into()]
        },
    })
}
