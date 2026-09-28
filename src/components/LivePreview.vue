<script setup>
import { computed } from 'vue'
import { getSkinStore } from '../composables/useSkinStore.js'
import { toCss } from '../utils/color.js'

const store = getSkinStore()
const { state } = store

const style = computed(() => state.style)
const colors = computed(() => store.activeScheme.value?.colors || {})
const L = computed(() => style.value.layout || {})

/** Weasel font_point 为 pt，CSS 用 px：1pt ≈ 4/3 px @96dpi */
function ptToPx(pt, fallback = 14) {
  const n = Number(pt)
  if (!Number.isFinite(n) || n <= 0) return fallback * (4 / 3)
  return n * (4 / 3)
}

function css(key, fallback = 'transparent') {
  const c = colors.value[key]
  return c ? toCss(c) : fallback
}

const isHorizontal = computed(() => !!style.value.horizontal && !style.value.vertical_text)

const windowCss = computed(() => {
  const bw = Number(L.value.border_width) || 0
  const shadows = []
  if ((L.value.shadow_radius || 0) > 0) {
    shadows.push(
      `${L.value.shadow_offset_x || 0}px ${L.value.shadow_offset_y || 0}px ${Math.max(2, L.value.shadow_radius)}px ${css('shadow_color', 'rgba(0,0,0,0.35)')}`,
    )
  }
  return {
    background: css('back_color', '#ffffff'),
    border: `${bw}px solid ${css('border_color', 'transparent')}`,
    borderRadius: `${L.value.corner_radius || 0}px`,
    boxShadow: shadows.length ? shadows.join(', ') : 'none',
    padding: `${L.value.margin_y ?? 8}px ${L.value.margin_x ?? 8}px`,
    fontFamily: style.value.font_face || 'Segoe UI, Microsoft YaHei, sans-serif',
  }
})

/** 预编辑区（inline_preedit=false 时出现在候选上方） */
const preeditCss = computed(() => ({
  color: css('text_color', '#111'),
  background: 'transparent',
  fontSize: `${ptToPx(style.value.font_point)}px`,
  lineHeight: 1.4,
  marginBottom: `${L.value.spacing ?? 8}px`,
  fontFamily: style.value.font_face || 'Segoe UI, Microsoft YaHei, sans-serif',
}))

const preeditHiliteCss = computed(() => ({
  color: css('hilited_text_color', '#fff'),
  background: css('hilited_back_color', 'transparent'),
  borderRadius: `${L.value.round_corner ?? 4}px`,
  padding: `0 ${Math.max(2, (L.value.hilite_padding ?? 8) / 2)}px`,
}))

function padX() {
  return L.value.hilite_padding_x ?? L.value.hilite_padding ?? 8
}
function padY() {
  return L.value.hilite_padding_y ?? L.value.hilite_padding ?? 6
}

function candidateWrapStyle(index) {
  const selected = index === state.selectedCandidate
  const gap = isHorizontal.value ? (L.value.candidate_spacing ?? 12) : 2
  return {
    display: 'inline-flex',
    alignItems: 'baseline',
    columnGap: `${L.value.hilite_spacing ?? 4}px`,
    rowGap: 2,
    padding: `${padY()}px ${padX()}px`,
    borderRadius: `${L.value.round_corner ?? 4}px`,
    marginRight: isHorizontal.value ? `${gap}px` : '0',
    marginBottom: isHorizontal.value ? '0' : `${Math.max(0, gap - padY())}px`,
    background: selected ? css('hilited_candidate_back_color', css('hilited_back_color', 'transparent')) : css('candidate_back_color', 'transparent'),
    border: selected && colors.value.hilited_candidate_border_color
      ? `1px solid ${css('hilited_candidate_border_color')}`
      : '1px solid transparent',
    cursor: 'default',
    whiteSpace: 'nowrap',
  }
}

function labelStyle(index) {
  const selected = index === state.selectedCandidate
  return {
    fontSize: `${ptToPx(style.value.label_font_point || style.value.font_point)}px`,
    fontFamily: style.value.label_font_face || style.value.font_face || 'sans-serif',
    color: selected
      ? css('hilited_label_color', css('hilited_candidate_text_color', '#fff'))
      : css('label_color', css('candidate_text_color', '#333')),
    fontFeatureSettings: '"tnum"',
  }
}

function textStyle(index) {
  const selected = index === state.selectedCandidate
  return {
    fontSize: `${ptToPx(style.value.font_point)}px`,
    color: selected
      ? css('hilited_candidate_text_color', '#fff')
      : css('candidate_text_color', css('text_color', '#111')),
    fontWeight: 500,
  }
}

function commentStyle(index) {
  const selected = index === state.selectedCandidate
  return {
    fontSize: `${ptToPx(style.value.comment_font_point || style.value.font_point - 1)}px`,
    fontFamily: style.value.comment_font_face || style.value.font_face || 'sans-serif',
    color: selected
      ? css('hilited_comment_text_color', css('hilited_candidate_text_color', '#fff'))
      : css('comment_text_color', css('label_color', '#666')),
  }
}

function formatLabel(i) {
  const fmt = style.value.label_format || '%s'
  return fmt.replace('%s', String(i + 1))
}

const showMark = computed(() => {
  const hasMarkColor = !!colors.value.hilited_mark_color
  return hasMarkColor || !!(style.value.mark_text && style.value.mark_text.length)
})

const markCss = computed(() => {
  // mark_text 为空且有 hilited_mark_color 时，Weasel 显示 Win11 风格竖条
  const emptyMark = !style.value.mark_text
  return {
    background: css('hilited_mark_color', 'transparent'),
    width: emptyMark ? '3px' : 'auto',
    minWidth: emptyMark ? '3px' : '0',
    height: emptyMark ? '1.1em' : 'auto',
    borderRadius: '2px',
    marginRight: '3px',
    alignSelf: 'center',
    color: css('hilited_mark_color', 'currentColor'),
    fontSize: `${ptToPx(style.value.font_point)}px`,
    lineHeight: 1,
  }
})

const pageColor = computed(() => css('nextpage_color', css('text_color', 'inherit')))
const prevColor = computed(() => css('prevpage_color', css('text_color', 'inherit')))

const candidates = computed(() => state.sampleCandidates)
</script>

<template>
  <div class="weasel-window" :style="windowCss">
    <!-- 编码区：仅 inline_preedit=false 时 -->
    <div v-if="!style.inline_preedit" class="weasel-preedit" :style="preeditCss">
      <span>{{ state.sampleText }}</span>
      <span class="preedit-hilite" :style="preeditHiliteCss">{{ state.sampleText.slice(0, 2) }}</span>
    </div>

    <!-- 候选区 -->
    <div
      class="weasel-candidates"
      :class="{ vertical: !isHorizontal }"
      :style="{
        flexDirection: isHorizontal ? 'row' : 'column',
        alignItems: isHorizontal ? 'stretch' : 'stretch',
        flexWrap: isHorizontal && L.max_width ? 'wrap' : 'nowrap',
        maxWidth: L.max_width ? L.max_width + 'px' : undefined,
      }"
    >
      <div
        v-for="(c, i) in candidates"
        :key="i"
        class="weasel-candidate"
        :style="candidateWrapStyle(i)"
        @mouseenter="store.setSample(i)"
        @click="store.setSample(i)"
      >
        <!-- 标记：选中项、有 mark 或 mark 色 -->
        <span
          v-if="i === state.selectedCandidate && showMark"
          class="weasel-mark"
          :style="markCss"
        >{{ style.mark_text || '' }}</span>
        <span class="weasel-label" :style="labelStyle(i)">{{ formatLabel(i) }}</span>
        <span class="weasel-text" :style="textStyle(i)">{{ c.text }}</span>
        <span v-if="c.comment" class="weasel-comment" :style="commentStyle(i)">{{ c.comment }}</span>
      </div>

      <!-- 翻页箭头（inline_preedit=false 且设置了颜色时） -->
      <template v-if="!style.inline_preedit">
        <span class="weasel-page" :style="{ color: prevColor }">‹</span>
        <span class="weasel-page" :style="{ color: pageColor }">›</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.weasel-window {
  display: inline-flex;
  flex-direction: column;
  min-width: 160px;
  max-width: 100%;
  box-sizing: border-box;
  user-select: none;
}

.weasel-preedit {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0;
}

.preedit-hilite {
  display: inline-block;
}

.weasel-candidates {
  display: flex;
  align-items: center;
}

.weasel-candidate {
  transition: background 120ms ease, color 120ms ease;
}

.weasel-page {
  display: inline-flex;
  align-items: center;
  padding: 0 2px;
  opacity: 0.75;
  font-size: 14px;
}

.weasel-mark {
  display: inline-block;
  flex-shrink: 0;
}
</style>
