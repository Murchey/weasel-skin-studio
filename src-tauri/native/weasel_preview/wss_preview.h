#pragma once

#include <stddef.h>
#include <stdint.h>

typedef struct WssColor {
  uint8_t r, g, b, a;
} WssColor;

typedef struct WssCandidate {
  const char* label;
  const char* text;
  const char* comment;
} WssCandidate;

typedef struct WssPreviewInput {
  const char* font_face;
  const char* label_font_face;
  const char* comment_font_face;
  const char* label_format;
  const char* mark_text;
  const char* preedit;
  size_t preedit_highlight_start;
  size_t preedit_highlight_end;
  int font_point;
  int label_font_point;
  int comment_font_point;
  int layout_mode;
  int inline_preedit;
  int vertical_text_left_to_right;
  int vertical_text_with_wrap;
  int vertical_auto_reverse;
  int border;
  int margin_x;
  int margin_y;
  int spacing;
  int candidate_spacing;
  int hilite_spacing;
  int padding_x;
  int padding_y;
  int shadow_radius;
  int shadow_offset_x;
  int shadow_offset_y;
  int window_radius;
  int hilite_radius;
  int baseline;
  int linespacing;
  int antialias_mode;
  int min_width;
  int max_width;
  int min_height;
  int max_height;
  int selected;
  uint32_t dpi;
  const WssCandidate* candidates;
  size_t candidate_count;
  WssColor colors[28];
} WssPreviewInput;

typedef struct WssRegion {
  char id[64];
  float x, y, width, height;
} WssRegion;

typedef struct WssPreviewOutput {
  uint8_t* pixels_bgra;
  size_t pixel_len;
  int width;
  int height;
  WssRegion regions[256];
  size_t region_count;
  int used_directwrite;
} WssPreviewOutput;

#ifdef __cplusplus
extern "C" {
#endif

int wss_render_preview(const WssPreviewInput* input, WssPreviewOutput* output);
void wss_free_preview(WssPreviewOutput* output);

#ifdef __cplusplus
}
#endif
