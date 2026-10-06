#include "wss_preview.h"

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <objbase.h>
#include <d2d1.h>
#include <dwrite.h>
#include <wrl/client.h>
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <cwctype>
#include <string>
#include <vector>

namespace {

enum ColorIndex {
  C_BACK = 0,
  C_BORDER = 1,
  C_SHADOW = 2,
  C_TEXT = 3,
  C_HILITED_TEXT = 4,
  C_HILITED_BACK = 5,
  C_HILITED_SHADOW = 6,
  C_LABEL = 7,
  C_CANDIDATE_TEXT = 8,
  C_CANDIDATE_BACK = 9,
  C_CANDIDATE_BORDER = 10,
  C_CANDIDATE_SHADOW = 11,
  C_COMMENT = 12,
  C_HILITED_COMMENT = 13,
  C_HILITED_MARK = 14,
  C_HILITED_LABEL = 15,
  C_HILITED_CANDIDATE_TEXT = 16,
  C_HILITED_CANDIDATE_BACK = 17,
  C_HILITED_CANDIDATE_BORDER = 18,
  C_HILITED_CANDIDATE_SHADOW = 19,
  C_HILITED_CANDIDATE_LABEL = 20,
  C_NEXTPAGE = 21,
  C_PREVPAGE = 22,
};

struct Rect { int l, t, r, b; };

using Microsoft::WRL::ComPtr;

static std::wstring utf8_to_wide(const char* value);

// The shipped preview uses the same Windows text stack as Weasel.  GDI is
// retained as a small emergency path for machines where DirectWrite/D2D
// cannot be initialized (for example, a remote session with a damaged font
// cache), but all normal measurements and glyphs go through this context.
struct DWriteContext {
  ComPtr<ID2D1Factory> d2d_factory;
  ComPtr<ID2D1DCRenderTarget> render_target;
  ComPtr<IDWriteFactory> write_factory;
  ComPtr<IDWriteTextFormat> text_format;
  ComPtr<IDWriteTextFormat> label_format;
  ComPtr<IDWriteTextFormat> comment_format;
  bool drawing = false;
};

struct ComScope {
  bool owned = false;
  ComScope() {
    const HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    owned = SUCCEEDED(hr);
  }
  ~ComScope() {
    if (owned) CoUninitialize();
  }
};

static D2D1_COLOR_F d2d_color(WssColor c) {
  return D2D1::ColorF(c.r / 255.0f, c.g / 255.0f, c.b / 255.0f,
                      c.a / 255.0f);
}

static std::wstring first_font_face(const char* value) {
  std::wstring face = utf8_to_wide(value);
  const size_t comma = face.find(L',');
  if (comma != std::wstring::npos) face.resize(comma);
  while (!face.empty() && std::iswspace(face.back())) face.pop_back();
  size_t start = 0;
  while (start < face.size() && std::iswspace(face[start])) ++start;
  if (start) face.erase(0, start);
  return face.empty() ? L"Segoe UI" : face;
}

static bool init_dwrite(DWriteContext* ctx, const WssPreviewInput* input) {
  if (!ctx || !input) return false;
  if (FAILED(DWriteCreateFactory(DWRITE_FACTORY_TYPE_SHARED,
                                 __uuidof(IDWriteFactory),
                                 reinterpret_cast<IUnknown**>(ctx->write_factory.ReleaseAndGetAddressOf()))))
    return false;
  if (FAILED(D2D1CreateFactory(D2D1_FACTORY_TYPE_SINGLE_THREADED,
                               ctx->d2d_factory.ReleaseAndGetAddressOf())))
    return false;

  const float scale = (float)(input->dpi ? input->dpi : 96) / 72.0f;
  auto create_format = [&](const char* face, int point,
                           ComPtr<IDWriteTextFormat>& target) -> bool {
    HRESULT hr = ctx->write_factory->CreateTextFormat(
        first_font_face(face).c_str(), nullptr, DWRITE_FONT_WEIGHT_NORMAL,
        DWRITE_FONT_STYLE_NORMAL, DWRITE_FONT_STRETCH_NORMAL,
        std::max(1.0f, point * scale), L"zh-CN", target.ReleaseAndGetAddressOf());
    if (FAILED(hr) || !target) return false;
    target->SetTextAlignment(DWRITE_TEXT_ALIGNMENT_LEADING);
    target->SetParagraphAlignment(DWRITE_PARAGRAPH_ALIGNMENT_NEAR);
    target->SetWordWrapping(DWRITE_WORD_WRAPPING_NO_WRAP);
    if (input->layout_mode == 2) {
      target->SetReadingDirection(DWRITE_READING_DIRECTION_TOP_TO_BOTTOM);
      target->SetFlowDirection(input->vertical_text_left_to_right
                                   ? DWRITE_FLOW_DIRECTION_LEFT_TO_RIGHT
                                   : DWRITE_FLOW_DIRECTION_RIGHT_TO_LEFT);
    }
    if (input->linespacing > 0 && input->baseline > 0) {
      target->SetLineSpacing(DWRITE_LINE_SPACING_METHOD_UNIFORM,
                             point * scale * input->linespacing / 100.0f,
                             point * scale * input->baseline / 100.0f);
    }
    return true;
  };
  if (!create_format(input->font_face, input->font_point, ctx->text_format) ||
      !create_format(input->label_font_face, input->label_font_point, ctx->label_format) ||
      !create_format(input->comment_font_face, input->comment_font_point, ctx->comment_format))
    return false;
  return true;
}

static SIZE measure_dwrite(DWriteContext* ctx, IDWriteTextFormat* format,
                           const char* text) {
  SIZE result{0, 0};
  if (!ctx || !ctx->write_factory || !format) return result;
  std::wstring value = utf8_to_wide(text);
  if (value.empty()) value = L" ";
  ComPtr<IDWriteTextLayout> layout;
  if (FAILED(ctx->write_factory->CreateTextLayout(value.c_str(),
                                                   (UINT32)value.size(), format,
                                                   65535.0f, 65535.0f,
                                                   layout.ReleaseAndGetAddressOf())))
    return result;
  DWRITE_TEXT_METRICS metrics{};
  if (FAILED(layout->GetMetrics(&metrics))) return result;
  result.cx = (LONG)std::ceil(metrics.widthIncludingTrailingWhitespace);
  result.cy = (LONG)std::ceil(metrics.height);
  return result;
}

static bool hit_test_text_range(DWriteContext* ctx, IDWriteTextFormat* format,
                                const char* text, size_t start, size_t end,
                                Rect* result) {
  if (!ctx || !ctx->write_factory || !format || !text || !result) return false;
  std::wstring value = utf8_to_wide(text);
  if (value.empty()) return false;
  start = std::min(start, value.size());
  end = std::min(std::max(end, start), value.size());
  if (start == end) return false;
  ComPtr<IDWriteTextLayout> layout;
  if (FAILED(ctx->write_factory->CreateTextLayout(value.c_str(), (UINT32)value.size(),
                                                   format, 65535.0f, 65535.0f,
                                                   layout.ReleaseAndGetAddressOf())))
    return false;
  FLOAT x0 = 0, y0 = 0, x1 = 0, y1 = 0;
  DWRITE_HIT_TEST_METRICS first{}, last{};
  if (FAILED(layout->HitTestTextPosition((UINT32)start, FALSE, &x0, &y0, &first)) ||
      FAILED(layout->HitTestTextPosition((UINT32)(end - 1), FALSE, &x1, &y1, &last)))
    return false;
  const FLOAT left = std::min(x0, x1);
  const FLOAT top = std::min(y0, y1);
  const FLOAT right = std::max(x0 + first.width, x1 + last.width);
  const FLOAT bottom = std::max(y0 + first.height, y1 + last.height);
  *result = {(int)std::floor(left), (int)std::floor(top),
             (int)std::ceil(right), (int)std::ceil(bottom)};
  return result->r > result->l && result->b > result->t;
}

static bool begin_dwrite(DWriteContext* ctx, HDC dc, int width, int height) {
  if (!ctx || !ctx->d2d_factory || !dc) return false;
  const D2D1_RENDER_TARGET_PROPERTIES properties = D2D1::RenderTargetProperties(
      D2D1_RENDER_TARGET_TYPE_DEFAULT,
      D2D1::PixelFormat(DXGI_FORMAT_B8G8R8A8_UNORM,
                        D2D1_ALPHA_MODE_PREMULTIPLIED));
  if (FAILED(ctx->d2d_factory->CreateDCRenderTarget(
                 &properties, ctx->render_target.ReleaseAndGetAddressOf())))
    return false;
  RECT rect{0, 0, width, height};
  if (FAILED(ctx->render_target->BindDC(dc, &rect))) return false;
  ctx->render_target->SetAntialiasMode(D2D1_ANTIALIAS_MODE_PER_PRIMITIVE);
  ctx->render_target->SetTextAntialiasMode(D2D1_TEXT_ANTIALIAS_MODE_DEFAULT);
  ctx->render_target->BeginDraw();
  ctx->drawing = true;
  return true;
}

static void end_dwrite(DWriteContext* ctx) {
  if (!ctx || !ctx->drawing) return;
  ctx->render_target->EndDraw();
  ctx->drawing = false;
}

static int pt_to_px(int pt, uint32_t dpi) {
  return std::max(1, (int)std::lround((double)std::max(pt, 1) * dpi / 72.0));
}

static std::wstring utf8_to_wide(const char* value) {
  if (!value || !*value) return L"Segoe UI";
  int n = MultiByteToWideChar(CP_UTF8, 0, value, -1, nullptr, 0);
  std::wstring result((size_t)std::max(n, 1), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, value, -1, result.data(), n);
  if (!result.empty() && result.back() == L'\0') result.pop_back();
  // Weasel font strings may include weight/style suffixes and fallbacks.
  const size_t comma = result.find(L',');
  if (comma != std::wstring::npos) result.resize(comma);
  const size_t colon = result.find(L':');
  if (colon != std::wstring::npos) result.resize(colon);
  return result.empty() ? L"Segoe UI" : result;
}

static COLORREF rgb(WssColor c) { return RGB(c.r, c.g, c.b); }

static bool visible(WssColor c) { return c.a != 0; }

static void fill_bgra(std::vector<uint8_t>& pixels, int width, int height, WssColor c) {
  pixels.resize((size_t)width * (size_t)height * 4);
  for (size_t i = 0; i < pixels.size(); i += 4) {
    pixels[i + 0] = c.b;
    pixels[i + 1] = c.g;
    pixels[i + 2] = c.r;
    pixels[i + 3] = c.a;
  }
}

static void add_region(WssPreviewOutput* out, const char* id, Rect r) {
  if (!out || out->region_count >= 256) return;
  WssRegion& region = out->regions[out->region_count++];
  std::strncpy(region.id, id, sizeof(region.id) - 1);
  region.id[sizeof(region.id) - 1] = '\0';
  region.x = (float)r.l;
  region.y = (float)r.t;
  region.width = (float)std::max(0, r.r - r.l);
  region.height = (float)std::max(0, r.b - r.t);
}

static SIZE measure(HDC dc, HFONT font, const char* text) {
  std::wstring value = utf8_to_wide(text);
  if (value.empty()) value = L" ";
  HFONT old = (HFONT)SelectObject(dc, font);
  SIZE size{0, 0};
  GetTextExtentPoint32W(dc, value.c_str(), (int)value.size(), &size);
  SelectObject(dc, old);
  return size;
}

static void draw_text(HDC dc, HFONT font, WssColor color, int x, int y, const char* text) {
  if (!text || !*text || !visible(color)) return;
  std::wstring value = utf8_to_wide(text);
  HFONT oldFont = (HFONT)SelectObject(dc, font);
  int oldBk = SetBkMode(dc, TRANSPARENT);
  COLORREF oldColor = SetTextColor(dc, rgb(color));
  TextOutW(dc, x, y, value.c_str(), (int)value.size());
  SetTextColor(dc, oldColor);
  SetBkMode(dc, oldBk);
  SelectObject(dc, oldFont);
}

static void draw_text_dwrite(DWriteContext* ctx, IDWriteTextFormat* format,
                             WssColor color, int x, int y, const char* text) {
  if (!ctx || !ctx->drawing || !format || !text || !*text || !visible(color)) return;
  std::wstring value = utf8_to_wide(text);
  if (value.empty()) return;
  ComPtr<ID2D1SolidColorBrush> brush;
  if (FAILED(ctx->render_target->CreateSolidColorBrush(
                 d2d_color(color), brush.ReleaseAndGetAddressOf()))) return;
  const D2D1_RECT_F rect = D2D1::RectF((float)x, (float)y,
                                       (float)x + 65535.0f,
                                       (float)y + 65535.0f);
  ctx->render_target->DrawText(value.c_str(), (UINT32)value.size(), format,
                               &rect, brush.Get(),
                               D2D1_DRAW_TEXT_OPTIONS_ENABLE_COLOR_FONT);
}

static void fill_rounded_dwrite(DWriteContext* ctx, Rect r, int radius,
                                WssColor color) {
  if (!ctx || !ctx->drawing || !visible(color)) return;
  ComPtr<ID2D1SolidColorBrush> brush;
  if (FAILED(ctx->render_target->CreateSolidColorBrush(
                 d2d_color(color), brush.ReleaseAndGetAddressOf()))) return;
  const D2D1_ROUNDED_RECT rounded = D2D1::RoundedRect(
      D2D1::RectF((float)r.l, (float)r.t, (float)r.r, (float)r.b),
      (float)std::max(0, radius), (float)std::max(0, radius));
  ctx->render_target->FillRoundedRectangle(&rounded, brush.Get());
}

static void stroke_rounded_dwrite(DWriteContext* ctx, Rect r, int radius,
                                  int width, WssColor color) {
  if (!ctx || !ctx->drawing || width <= 0 || !visible(color)) return;
  ComPtr<ID2D1SolidColorBrush> brush;
  if (FAILED(ctx->render_target->CreateSolidColorBrush(
                 d2d_color(color), brush.ReleaseAndGetAddressOf()))) return;
  const D2D1_ROUNDED_RECT rounded = D2D1::RoundedRect(
      D2D1::RectF((float)r.l, (float)r.t, (float)r.r, (float)r.b),
      (float)std::max(0, radius), (float)std::max(0, radius));
  ctx->render_target->DrawRoundedRectangle(&rounded, brush.Get(), (float)width);
}

static void rounded_fill(HDC dc, Rect r, int radius, WssColor color) {
  if (!visible(color)) return;
  HBRUSH brush = CreateSolidBrush(rgb(color));
  HBRUSH old = (HBRUSH)SelectObject(dc, brush);
  HPEN pen = CreatePen(PS_NULL, 0, 0);
  HPEN oldPen = (HPEN)SelectObject(dc, pen);
  RoundRect(dc, r.l, r.t, r.r, r.b, std::max(0, radius * 2), std::max(0, radius * 2));
  SelectObject(dc, oldPen);
  DeleteObject(pen);
  SelectObject(dc, old);
  DeleteObject(brush);
}

} // namespace

extern "C" int wss_render_preview(const WssPreviewInput* input, WssPreviewOutput* output) {
  if (!input || !output) return 0;
  ComScope comScope;
  std::memset(output, 0, sizeof(WssPreviewOutput));

  const uint32_t dpi = input->dpi ? input->dpi : 96;
  const int fontPx = pt_to_px(input->font_point, dpi);
  const int labelPx = pt_to_px(input->label_font_point, dpi);
  const int commentPx = pt_to_px(input->comment_font_point, dpi);
  const int padX = std::max(0, input->padding_x);
  const int padY = std::max(0, input->padding_y);
  const int marginX = std::max(std::abs(input->margin_x), padX);
  const int marginY = std::max(std::abs(input->margin_y), padY);
  const int border = std::max(0, input->border);
  const int gap = std::max(0, input->hilite_spacing);
  const int candidateGap = std::max(0, input->candidate_spacing);
  const int windowRadius = std::max(0, input->window_radius);
  const int hiliteRadius = std::max(0, input->hilite_radius);
  const bool markVisible = visible(input->colors[C_HILITED_MARK]);
  const int defaultMarkWidth = std::max(6, fontPx / 7);
  const int markWidth = markVisible
      ? ((input->mark_text && *input->mark_text) ? std::max(1, fontPx) : defaultMarkWidth)
      : 0;
  const int markGap = markVisible ? markWidth + (input->mark_text && *input->mark_text ? gap : 0) : 0;
  int offsetX = border * 2;
  int offsetY = border * 2;
  if (input->shadow_radius != 0) {
    offsetX += std::abs(input->shadow_offset_x) + input->shadow_radius * 2;
    offsetY += std::abs(input->shadow_offset_y) + input->shadow_radius * 2;
    if (input->shadow_offset_x != 0 || input->shadow_offset_y != 0) {
      offsetX -= input->shadow_radius / 2;
      offsetY -= input->shadow_radius / 2;
    }
  }

  HDC dc = CreateCompatibleDC(nullptr);
  if (!dc) return 0;

  HFONT font = CreateFontW(-fontPx, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
                           DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
                           CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_DONTCARE,
                           utf8_to_wide(input->font_face).c_str());
  HFONT labelFont = CreateFontW(-labelPx, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
                                DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
                                CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_DONTCARE,
                                utf8_to_wide(input->label_font_face).c_str());
  HFONT commentFont = CreateFontW(-commentPx, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
                                  DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
                                  CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_DONTCARE,
                                  utf8_to_wide(input->comment_font_face).c_str());
  if (!font || !labelFont || !commentFont) {
    if (font) DeleteObject(font);
    if (labelFont) DeleteObject(labelFont);
    if (commentFont) DeleteObject(commentFont);
    DeleteDC(dc);
    return 0;
  }

  DWriteContext dwrite;
  const bool useDWrite = init_dwrite(&dwrite, input);
  auto measure_text = [&](HFONT fallbackFont, IDWriteTextFormat* format,
                          const char* value) {
    return useDWrite ? measure_dwrite(&dwrite, format, value)
                     : measure(dc, fallbackFont, value);
  };

  std::vector<SIZE> labelSize(input->candidate_count), textSize(input->candidate_count), commentSize(input->candidate_count);
  int contentWidth = marginX * 2 + offsetX;
  int contentHeight = marginY * 2 + offsetY;
  int preeditHeight = 0;
  if (!input->inline_preedit && input->preedit && *input->preedit) {
    SIZE s = measure_text(font, dwrite.text_format.Get(), input->preedit);
    preeditHeight = s.cy;
  }

  for (size_t i = 0; i < input->candidate_count; ++i) {
    labelSize[i] = measure_text(labelFont, dwrite.label_format.Get(), input->candidates[i].label);
    textSize[i] = measure_text(font, dwrite.text_format.Get(), input->candidates[i].text);
    commentSize[i] = measure_text(commentFont, dwrite.comment_format.Get(), input->candidates[i].comment);
  }

  const bool horizontal = input->layout_mode == 1;
  const bool verticalText = input->layout_mode == 2;
  std::vector<Rect> rects(input->candidate_count);
  std::vector<int> rowHeights(input->candidate_count, 0);

  if (horizontal) {
    int width = offsetX + marginX;
    int height = offsetY + marginY + (preeditHeight ? preeditHeight + input->spacing : 0);
    for (size_t i = 0; i < input->candidate_count; ++i) {
      int h = std::max({labelSize[i].cy, textSize[i].cy, commentSize[i].cy});
      int w = labelSize[i].cx + gap + textSize[i].cx;
      const bool commentVisible = input->candidates[i].comment && *input->candidates[i].comment &&
          visible((int)i == input->selected ? input->colors[C_HILITED_COMMENT] : input->colors[C_COMMENT]);
      if (commentVisible) w += gap + commentSize[i].cx;
      const int start = width + ((int)i == input->selected ? markGap : 0);
      rects[i] = {start, height, start + w, height + h};
      width += w + ((int)i == input->selected ? markGap : 0) +
               (i + 1 < input->candidate_count ? candidateGap : 0);
      height = std::max(height, rects[i].b);
    }
    contentWidth = std::max(contentWidth, width + marginX);
    contentHeight = std::max(contentHeight, height + marginY);
  } else {
    int width = offsetX + marginX;
    int y = offsetY + marginY + (preeditHeight ? preeditHeight + input->spacing : 0);
    for (size_t i = 0; i < input->candidate_count; ++i) {
      int h = verticalText ? std::max({labelSize[i].cx, textSize[i].cx, commentSize[i].cx}) : std::max({labelSize[i].cy, textSize[i].cy, commentSize[i].cy});
      int w = verticalText ? labelSize[i].cy + gap + textSize[i].cy : labelSize[i].cx + gap + textSize[i].cx;
      const bool commentVisible = input->candidates[i].comment && *input->candidates[i].comment &&
          visible((int)i == input->selected ? input->colors[C_HILITED_COMMENT] : input->colors[C_COMMENT]);
      if (commentVisible) w += gap + (verticalText ? commentSize[i].cy : commentSize[i].cx);
      const int start = offsetX + marginX + ((int)i == input->selected && !verticalText ? markGap : 0);
      rects[i] = {start, y, start + w, y + h};
      width = std::max(width, rects[i].r);
      y += h + (i + 1 < input->candidate_count ? candidateGap : 0);
    }
    contentWidth = std::max(contentWidth, width + marginX);
    contentHeight = std::max(contentHeight, y + marginY);
  }

  if (input->min_width > 0) contentWidth = std::max(contentWidth, input->min_width);
  if (input->min_height > 0) contentHeight = std::max(contentHeight, input->min_height);
  if (input->max_width > 0) contentWidth = std::min(contentWidth, input->max_width);
  if (input->max_height > 0) contentHeight = std::min(contentHeight, input->max_height);
  contentWidth = std::max(contentWidth, 80);
  contentHeight = std::max(contentHeight, 36);

  BITMAPINFO bmi{};
  bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
  bmi.bmiHeader.biWidth = contentWidth;
  bmi.bmiHeader.biHeight = -contentHeight;
  bmi.bmiHeader.biPlanes = 1;
  bmi.bmiHeader.biBitCount = 32;
  bmi.bmiHeader.biCompression = BI_RGB;
  void* bits = nullptr;
  HBITMAP bitmap = CreateDIBSection(dc, &bmi, DIB_RGB_COLORS, &bits, nullptr, 0);
  if (!bitmap || !bits) {
    DeleteObject(font); DeleteObject(labelFont); DeleteObject(commentFont); DeleteDC(dc);
    return 0;
  }
  HBITMAP oldBitmap = (HBITMAP)SelectObject(dc, bitmap);
  WssColor background = input->colors[C_BACK];
  const bool drawingDWrite = useDWrite && begin_dwrite(&dwrite, dc, contentWidth, contentHeight);
  if (drawingDWrite && input->antialias_mode >= 0 && input->antialias_mode <= 3) {
    dwrite.render_target->SetTextAntialiasMode(
        static_cast<D2D1_TEXT_ANTIALIAS_MODE>(input->antialias_mode));
  }
  if (drawingDWrite) {
    dwrite.render_target->Clear(D2D1::ColorF(0, 0, 0, 0));
    if (input->shadow_radius > 0 && visible(input->colors[C_SHADOW])) {
      fill_rounded_dwrite(&dwrite,
                          {input->shadow_offset_x, input->shadow_offset_y,
                           contentWidth + input->shadow_offset_x,
                           contentHeight + input->shadow_offset_y},
                          windowRadius + input->shadow_radius,
                          input->colors[C_SHADOW]);
    }
    fill_rounded_dwrite(&dwrite, {0, 0, contentWidth, contentHeight}, windowRadius, background);
    if (border > 0)
      stroke_rounded_dwrite(&dwrite, {border / 2, border / 2,
                                      contentWidth - border / 2,
                                      contentHeight - border / 2},
                            windowRadius, border, input->colors[C_BORDER]);
  } else {
    // Clear the DIB without relying on alpha-aware GDI brushes.
    std::memset(bits, 0, (size_t)contentWidth * (size_t)contentHeight * 4);
    if (input->shadow_radius > 0 && visible(input->colors[C_SHADOW])) {
      rounded_fill(dc, {input->shadow_offset_x, input->shadow_offset_y,
                        contentWidth + input->shadow_offset_x,
                        contentHeight + input->shadow_offset_y},
                   windowRadius + input->shadow_radius, input->colors[C_SHADOW]);
    }
    rounded_fill(dc, {0, 0, contentWidth, contentHeight}, windowRadius, background);
    if (border > 0 && visible(input->colors[C_BORDER])) {
      HPEN pen = CreatePen(PS_SOLID, border, rgb(input->colors[C_BORDER]));
      HBRUSH oldBrush = (HBRUSH)SelectObject(dc, GetStockObject(NULL_BRUSH));
      HPEN oldPen = (HPEN)SelectObject(dc, pen);
      RoundRect(dc, border / 2, border / 2, contentWidth - border / 2, contentHeight - border / 2, windowRadius * 2, windowRadius * 2);
      SelectObject(dc, oldPen); SelectObject(dc, oldBrush); DeleteObject(pen);
    }
  }
  auto draw_text_native = [&](HFONT fallbackFont, IDWriteTextFormat* format,
                              WssColor color, int x, int y, const char* value) {
    if (drawingDWrite) draw_text_dwrite(&dwrite, format, color, x, y, value);
    else draw_text(dc, fallbackFont, color, x, y, value);
  };

  add_region(output, "window", {0, 0, contentWidth, contentHeight});
  if (preeditHeight && !input->inline_preedit) {
    Rect pre = {offsetX + marginX, offsetY + marginY, contentWidth - marginX, offsetY + marginY + preeditHeight};
    add_region(output, "preedit", pre);
    Rect preeditHighlight{};
    if (input->preedit_highlight_end > input->preedit_highlight_start &&
        hit_test_text_range(&dwrite, dwrite.text_format.Get(), input->preedit,
                            input->preedit_highlight_start,
                            input->preedit_highlight_end, &preeditHighlight)) {
      preeditHighlight.l += pre.l;
      preeditHighlight.r += pre.l;
      preeditHighlight.t += pre.t;
      preeditHighlight.b += pre.t;
      add_region(output, "preedit-highlight", preeditHighlight);
      if (drawingDWrite)
        fill_rounded_dwrite(&dwrite, preeditHighlight, 1, input->colors[C_HILITED_BACK]);
      else
        rounded_fill(dc, preeditHighlight, 1, input->colors[C_HILITED_BACK]);
    }
    draw_text_native(font, dwrite.text_format.Get(), input->colors[C_TEXT], pre.l, pre.t, input->preedit);
  }

  for (size_t i = 0; i < input->candidate_count; ++i) {
    Rect r = rects[i];
    char id[64];
    std::snprintf(id, sizeof(id), "candidate:%zu", i);
    add_region(output, id, r);
    const bool selected = (int)i == input->selected;
    const Rect shadowRect = {r.l + input->shadow_offset_x, r.t + input->shadow_offset_y,
                             r.r + input->shadow_offset_x, r.b + input->shadow_offset_y};
    const WssColor shadowColor = selected ? input->colors[C_HILITED_CANDIDATE_SHADOW]
                                          : input->colors[C_CANDIDATE_SHADOW];
    if (input->shadow_radius > 0 && visible(shadowColor)) {
      if (drawingDWrite) fill_rounded_dwrite(&dwrite, shadowRect, hiliteRadius + input->shadow_radius, shadowColor);
      else rounded_fill(dc, shadowRect, hiliteRadius + input->shadow_radius, shadowColor);
    }
    const WssColor candidateBack = selected ? input->colors[C_HILITED_CANDIDATE_BACK]
                                            : input->colors[C_CANDIDATE_BACK];
    if (!selected && visible(candidateBack)) {
      if (drawingDWrite) fill_rounded_dwrite(&dwrite, r, hiliteRadius, candidateBack);
      else rounded_fill(dc, r, hiliteRadius, candidateBack);
    }
    const WssColor candidateBorder = selected ? input->colors[C_HILITED_CANDIDATE_BORDER]
                                              : input->colors[C_CANDIDATE_BORDER];
    if (visible(candidateBorder) && border > 0) {
      if (drawingDWrite) stroke_rounded_dwrite(&dwrite, r, hiliteRadius, border, candidateBorder);
      else {
        HPEN pen = CreatePen(PS_SOLID, border, rgb(candidateBorder));
        HBRUSH oldBrush = (HBRUSH)SelectObject(dc, GetStockObject(NULL_BRUSH));
        HPEN oldPen = (HPEN)SelectObject(dc, pen);
        RoundRect(dc, r.l, r.t, r.r, r.b, hiliteRadius * 2, hiliteRadius * 2);
        SelectObject(dc, oldPen); SelectObject(dc, oldBrush); DeleteObject(pen);
      }
    }
    if (selected) {
      Rect hi = {r.l - padX - markGap, r.t - padY, r.r + padX, r.b + padY};
      if (drawingDWrite)
        fill_rounded_dwrite(&dwrite, hi, hiliteRadius, input->colors[C_HILITED_CANDIDATE_BACK]);
      else
        rounded_fill(dc, hi, hiliteRadius, input->colors[C_HILITED_CANDIDATE_BACK]);
      add_region(output, "highlight", hi);
      if (visible(input->colors[C_HILITED_CANDIDATE_BORDER]) && border > 0) {
        if (drawingDWrite)
          stroke_rounded_dwrite(&dwrite, hi, hiliteRadius, border, input->colors[C_HILITED_CANDIDATE_BORDER]);
        else {
          HPEN pen = CreatePen(PS_SOLID, border, rgb(input->colors[C_HILITED_CANDIDATE_BORDER]));
          HBRUSH oldBrush = (HBRUSH)SelectObject(dc, GetStockObject(NULL_BRUSH));
          HPEN oldPen = (HPEN)SelectObject(dc, pen);
          RoundRect(dc, hi.l, hi.t, hi.r, hi.b, hiliteRadius * 2, hiliteRadius * 2);
          SelectObject(dc, oldPen); SelectObject(dc, oldBrush); DeleteObject(pen);
        }
      }
    }
    WssColor labelColor = selected ? input->colors[C_HILITED_CANDIDATE_LABEL] : input->colors[C_LABEL];
    WssColor textColor = selected ? input->colors[C_HILITED_CANDIDATE_TEXT] : input->colors[C_CANDIDATE_TEXT];
    WssColor commentColor = selected ? input->colors[C_HILITED_COMMENT] : input->colors[C_COMMENT];
    int x = r.l;
    int y = r.t;
    if (verticalText) {
      // The native Weasel vertical layout flows top-to-bottom. Drawing one
      // glyph per line keeps the same readable shape for the preview.
      std::string all = std::string(input->candidates[i].label ? input->candidates[i].label : "") +
                        (input->candidates[i].text ? input->candidates[i].text : "") +
                        (input->candidates[i].comment ? input->candidates[i].comment : "");
      draw_text_native(font, dwrite.text_format.Get(), textColor, x, y, all.c_str());
    } else {
      draw_text_native(labelFont, dwrite.label_format.Get(), labelColor, x, y, input->candidates[i].label);
      x += labelSize[i].cx + gap;
      draw_text_native(font, dwrite.text_format.Get(), textColor, x, y, input->candidates[i].text);
      x += textSize[i].cx;
      if (input->candidates[i].comment && *input->candidates[i].comment) {
        x += gap;
        draw_text_native(commentFont, dwrite.comment_format.Get(), commentColor, x, y, input->candidates[i].comment);
      }
    }
    if (selected && visible(input->colors[C_HILITED_MARK])) {
      Rect mark = {r.l - markGap, r.t, r.l - markGap + markWidth, r.b};
      if (input->mark_text && *input->mark_text)
        draw_text_native(font, dwrite.text_format.Get(), input->colors[C_HILITED_MARK], mark.l, mark.t, input->mark_text);
      else
        if (drawingDWrite)
          fill_rounded_dwrite(&dwrite, {mark.l, mark.t + 2, mark.r + 2, mark.b - 2}, 1, input->colors[C_HILITED_MARK]);
        else
          rounded_fill(dc, {mark.l, mark.t + 2, mark.r + 2, mark.b - 2}, 1, input->colors[C_HILITED_MARK]);
    }
  }

  if (drawingDWrite) end_dwrite(&dwrite);

  output->width = contentWidth;
  output->height = contentHeight;
  output->pixel_len = (size_t)contentWidth * (size_t)contentHeight * 4;
  output->used_directwrite = drawingDWrite ? 1 : 0;
  output->pixels_bgra = (uint8_t*)CoTaskMemAlloc(output->pixel_len);
  if (!output->pixels_bgra) {
    SelectObject(dc, oldBitmap); DeleteObject(bitmap); DeleteObject(font); DeleteObject(labelFont); DeleteObject(commentFont); DeleteDC(dc);
    return 0;
  }
  std::memcpy(output->pixels_bgra, bits, output->pixel_len);
  if (!drawingDWrite) {
    for (size_t i = 0; i < output->pixel_len; i += 4) {
      const bool hasColor = output->pixels_bgra[i] || output->pixels_bgra[i + 1] || output->pixels_bgra[i + 2];
      output->pixels_bgra[i + 3] = hasColor ? 255 : background.a;
    }
  }
  SelectObject(dc, oldBitmap);
  DeleteObject(bitmap); DeleteObject(font); DeleteObject(labelFont); DeleteObject(commentFont); DeleteDC(dc);
  return 1;
}

extern "C" void wss_free_preview(WssPreviewOutput* output) {
  if (!output) return;
  if (output->pixels_bgra) CoTaskMemFree(output->pixels_bgra);
  output->pixels_bgra = nullptr;
  output->pixel_len = 0;
}
