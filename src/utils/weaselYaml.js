import yaml from 'js-yaml'
import { parseWeaselColor, formatWeaselColor, convertFormat } from './color.js'

/** 配色字段元数据：key → 中文标签 / 分组 */
export const COLOR_FIELDS = [
  { key: 'back_color', label: '窗口背景', group: 'window' },
  { key: 'border_color', label: '窗口边框', group: 'window' },
  { key: 'shadow_color', label: '窗口阴影', group: 'window' },
  { key: 'text_color', label: '编码文字', group: 'preedit' },
  { key: 'hilited_text_color', label: '编码高亮文字', group: 'preedit' },
  { key: 'hilited_back_color', label: '编码高亮背景', group: 'preedit' },
  { key: 'hilited_shadow_color', label: '编码高亮阴影', group: 'preedit', optional: true },
  { key: 'label_color', label: '候选标签', group: 'candidate' },
  { key: 'candidate_text_color', label: '候选文字', group: 'candidate' },
  { key: 'candidate_back_color', label: '候选背景', group: 'candidate' },
  { key: 'candidate_border_color', label: '候选边框', group: 'candidate', optional: true },
  { key: 'candidate_shadow_color', label: '候选阴影', group: 'candidate', optional: true },
  { key: 'comment_text_color', label: '注释文字', group: 'comment' },
  { key: 'hilited_comment_text_color', label: '高亮注释', group: 'comment' },
  { key: 'hilited_mark_color', label: '选中标记', group: 'hilited' },
  { key: 'hilited_label_color', label: '高亮标签', group: 'hilited' },
  { key: 'hilited_candidate_text_color', label: '高亮候选文字', group: 'hilited' },
  { key: 'hilited_candidate_back_color', label: '高亮候选背景', group: 'hilited' },
  { key: 'hilited_candidate_border_color', label: '高亮候选边框', group: 'hilited' },
  { key: 'hilited_candidate_shadow_color', label: '高亮候选阴影', group: 'hilited', optional: true },
  { key: 'hilited_candidate_label_color', label: '高亮候选标签', group: 'hilited', optional: true },
  { key: 'nextpage_color', label: '下一页箭头', group: 'paging', optional: true },
  { key: 'prevpage_color', label: '上一页箭头', group: 'paging', optional: true },
]

export const COLOR_GROUPS = {
  window: '窗口',
  preedit: '预编辑区',
  candidate: '候选项',
  comment: '注释',
  hilited: '高亮选中',
  paging: '翻页箭头',
}

export const STYLE_DEFAULTS = {
  color_scheme: 'custom',
  color_scheme_dark: '',
  font_face: 'Microsoft YaHei, Segoe UI, sans-serif',
  label_font_face: 'Microsoft YaHei',
  comment_font_face: 'Microsoft YaHei',
  font_point: 14,
  label_font_point: 14,
  comment_font_point: 13,
  inline_preedit: true,
  preedit_type: 'composition',
  fullscreen: false,
  horizontal: true,
  vertical_text: false,
  vertical_text_left_to_right: false,
  vertical_text_with_wrap: false,
  vertical_auto_reverse: false,
  label_format: '%s',
  mark_text: '',
  hover_type: 'none',
  paging_on_scroll: true,
  candidate_abbreviate_length: 30,
  antialias_mode: 'default',
  layout: {
    baseline: 0,
    linespacing: 0,
    align_type: 'center',
    max_height: 600,
    max_width: 0,
    min_height: 0,
    min_width: 10,
    border_width: 2,
    margin_x: 8,
    margin_y: 8,
    spacing: 13,
    candidate_spacing: 22,
    hilite_spacing: 6,
    hilite_padding: 8,
    shadow_radius: 0,
    shadow_offset_x: 4,
    shadow_offset_y: 4,
    corner_radius: 8,
    round_corner: 8,
  },
}

/** 从 weasel.yaml 文本提取 style + preset_color_schemes */
export function parseWeaselYaml(text) {
  const doc = yaml.load(text)
  if (!doc || typeof doc !== 'object') {
    throw new Error('无法解析 YAML')
  }
  const style = { ...STYLE_DEFAULTS, ...(doc.style || {}) }
  if (doc.style?.layout) {
    style.layout = { ...STYLE_DEFAULTS.layout, ...doc.style.layout }
  }
  const presets = {}
  const schemes = doc.preset_color_schemes || {}
  for (const [id, raw] of Object.entries(schemes)) {
    if (!raw || typeof raw !== 'object') continue
    presets[id] = normalizeScheme(id, raw)
  }
  return { style, presets, rawDoc: doc }
}

export function normalizeScheme(id, raw) {
  const format = raw.color_format || 'abgr'
  const colors = {}
  for (const field of COLOR_FIELDS) {
    const v = raw[field.key]
    if (v == null || v === '') continue
    const rgba = parseWeaselColor(v, format)
    if (rgba) colors[field.key] = rgba
  }
  return {
    id,
    name: raw.name || id,
    author: raw.author || '',
    color_format: format,
    colors,
  }
}

/** 生成 weasel 可粘贴的 preset_color_schemes YAML 片段 */
export function exportSchemeYaml(scheme) {
  const format = scheme.color_format || 'abgr'
  const lines = []
  lines.push(`  ${scheme.id}:`)
  lines.push(`    name: "${String(scheme.name || scheme.id).replace(/"/g, '\\"')}"`)
  if (scheme.author) lines.push(`    author: ${scheme.author}`)
  lines.push(`    color_format: ${format}`)
  for (const field of COLOR_FIELDS) {
    const rgba = scheme.colors[field.key]
    if (!rgba) continue
    const val = formatWeaselColor(rgba, format)
    lines.push(`    ${field.key}: ${val}`)
  }
  return lines.join('\n')
}

/** 生成 style: 段 YAML */
export function exportStyleYaml(style) {
  const lines = []
  lines.push('style:')
  lines.push(`  color_scheme: ${style.color_scheme || 'custom'}`)
  if (style.color_scheme_dark) {
    lines.push(`  color_scheme_dark: ${style.color_scheme_dark}`)
  }
  lines.push(`  font_face: ${JSON.stringify(style.font_face || '')}`)
  lines.push(`  label_font_face: ${JSON.stringify(style.label_font_face || '')}`)
  lines.push(`  comment_font_face: ${JSON.stringify(style.comment_font_face || '')}`)
  lines.push(`  font_point: ${style.font_point}`)
  lines.push(`  label_font_point: ${style.label_font_point}`)
  lines.push(`  comment_font_point: ${style.comment_font_point}`)
  lines.push(`  inline_preedit: ${!!style.inline_preedit}`)
  lines.push(`  preedit_type: ${style.preedit_type || 'composition'}`)
  lines.push(`  fullscreen: ${!!style.fullscreen}`)
  lines.push(`  horizontal: ${!!style.horizontal}`)
  lines.push(`  vertical_text: ${!!style.vertical_text}`)
  lines.push(`  vertical_text_left_to_right: ${!!style.vertical_text_left_to_right}`)
  lines.push(`  vertical_text_with_wrap: ${!!style.vertical_text_with_wrap}`)
  lines.push(`  vertical_auto_reverse: ${!!style.vertical_auto_reverse}`)
  lines.push(`  label_format: ${JSON.stringify(style.label_format || '%s')}`)
  lines.push(`  mark_text: ${JSON.stringify(style.mark_text || '')}`)
  lines.push(`  hover_type: ${style.hover_type || 'none'}`)
  lines.push(`  paging_on_scroll: ${!!style.paging_on_scroll}`)
  lines.push(`  candidate_abbreviate_length: ${style.candidate_abbreviate_length ?? 30}`)
  lines.push(`  antialias_mode: ${style.antialias_mode || 'default'}`)
  lines.push('  layout:')
  const L = style.layout || {}
  for (const [k, v] of Object.entries(L)) {
    if (v == null || v === '') continue
    const num = typeof v === 'number' || /^(true|false)$/.test(String(v)) ? v : v
    lines.push(`    ${k}: ${num}`)
  }
  return lines.join('\n')
}

/** 完整导出（可粘贴进 weasel.yaml） */
export function exportFullYaml(style, schemes) {
  const parts = []
  parts.push('# 由 Weasel Skin Studio 生成')
  parts.push('# 粘贴到 weasel.yaml 时，请替换对应 style / preset_color_schemes 段')
  parts.push('')
  parts.push(exportStyleYaml(style))
  parts.push('')
  parts.push('preset_color_schemes:')
  for (const scheme of schemes) {
    parts.push(exportSchemeYaml(scheme))
    parts.push('')
  }
  return parts.join('\n')
}

/** 把配色方案在不同 color_format 间迁移（所有颜色键） */
export function migrateSchemeFormat(scheme, toFormat) {
  const from = scheme.color_format || 'abgr'
  if (from === toFormat) return { ...scheme }
  const colors = {}
  for (const [k, v] of Object.entries(scheme.colors)) {
    const hexLike = formatWeaselColor(v, from)
    // 先回到中间 rgba，再按目标格式写出
    const mid = parseWeaselColor(hexLike, from)
    colors[k] = mid
  }
  return { ...scheme, color_format: toFormat, colors }
}

export { convertFormat }
