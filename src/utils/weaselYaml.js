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
  color_scheme: 'aqua',
  color_scheme_dark: '',
  font_face: 'Microsoft YaHei',
  label_font_face: 'Microsoft YaHei',
  comment_font_face: 'Microsoft YaHei',
  font_point: 14,
  label_font_point: 14,
  comment_font_point: 14,
  // 官方 weasel.yaml 默认
  inline_preedit: false,
  preedit_type: 'composition',
  fullscreen: false,
  horizontal: false,
  vertical_text: false,
  vertical_text_left_to_right: false,
  vertical_text_with_wrap: false,
  vertical_auto_reverse: false,
  label_format: '%s.',
  mark_text: '',
  hover_type: 'none',
  paging_on_scroll: false,
  candidate_abbreviate_length: 0,
  antialias_mode: 'default',
  display_tray_icon: true,
  ascii_tip_follow_cursor: false,
  enhanced_position: true,
  click_to_capture: false,
  text_orientation: 'horizontal',
  layout: {
    baseline: 0,
    linespacing: 0,
    align_type: 'center',
    max_height: 0,
    max_width: 0,
    min_height: 0,
    min_width: 160,
    border_width: 3,
    margin_x: 12,
    margin_y: 12,
    spacing: 10,
    candidate_spacing: 5,
    hilite_spacing: 4,
    // Weasel: hilite_padding_x/y 可拆分，默认 hilite_padding
    hilite_padding: 2,
    shadow_radius: 0,
    shadow_offset_x: 4,
    shadow_offset_y: 4,
    corner_radius: 4,
    round_corner: 4,
  },
}

const STYLE_NUMBER_KEYS = [
  'font_point',
  'label_font_point',
  'comment_font_point',
  'candidate_abbreviate_length',
]

const LAYOUT_NUMBER_KEYS = [
  'baseline',
  'linespacing',
  'max_height',
  'max_width',
  'min_height',
  'min_width',
  'border',
  'border_width',
  'margin_x',
  'margin_y',
  'spacing',
  'candidate_spacing',
  'hilite_spacing',
  'hilite_padding',
  'hilite_padding_x',
  'hilite_padding_y',
  'shadow_radius',
  'shadow_offset_x',
  'shadow_offset_y',
  'corner_radius',
  'round_corner',
  'hilited_corner_radius',
]

function finiteNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Normalize the subset of UIStyle that is shared by the editor, preview and
 * exporters. Weasel accepts a few historical aliases and applies minimum
 * spacing rules while parsing; keeping that behavior here prevents the three
 * surfaces from drifting apart.
 */
export function normalizeWeaselStyle(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const style = { ...STYLE_DEFAULTS, ...source }
  const rawLayout = source.layout && typeof source.layout === 'object' ? source.layout : {}
  const layout = { ...STYLE_DEFAULTS.layout, ...rawLayout }

  // Rime/Weasel aliases. Keep both keys in the normalized object so old
  // configs and the UI can round-trip without losing intent.
  const border = rawLayout.border ?? rawLayout.border_width ?? STYLE_DEFAULTS.layout.border_width
  layout.border = finiteNumber(border, STYLE_DEFAULTS.layout.border_width)
  layout.border_width = layout.border

  const windowRadius = rawLayout.corner_radius ?? rawLayout.round_corner_ex ?? STYLE_DEFAULTS.layout.corner_radius
  const hiliteRadius =
    rawLayout.hilited_corner_radius ?? rawLayout.round_corner ?? STYLE_DEFAULTS.layout.round_corner
  layout.corner_radius = Math.max(0, finiteNumber(windowRadius, STYLE_DEFAULTS.layout.corner_radius))
  layout.round_corner = Math.max(0, finiteNumber(hiliteRadius, STYLE_DEFAULTS.layout.round_corner))

  const padding = finiteNumber(rawLayout.hilite_padding, STYLE_DEFAULTS.layout.hilite_padding)
  layout.hilite_padding = Math.max(0, padding)
  layout.hilite_padding_x = Math.max(
    0,
    finiteNumber(rawLayout.hilite_padding_x, layout.hilite_padding),
  )
  layout.hilite_padding_y = Math.max(
    0,
    finiteNumber(rawLayout.hilite_padding_y, layout.hilite_padding),
  )

  for (const key of STYLE_NUMBER_KEYS) {
    style[key] = finiteNumber(style[key], STYLE_DEFAULTS[key])
  }
  for (const key of LAYOUT_NUMBER_KEYS) {
    if (key === 'border' || key === 'border_width' || key === 'corner_radius' || key === 'round_corner' || key === 'hilited_corner_radius' || key === 'hilite_padding' || key === 'hilite_padding_x' || key === 'hilite_padding_y') continue
    layout[key] = finiteNumber(layout[key], STYLE_DEFAULTS.layout[key] ?? 0)
  }

  // This mirrors RimeWithWeasel.cpp: padding establishes a lower bound for
  // the spacing that separates candidates and their inline parts. Margins may
  // remain negative; the native layout uses their absolute value while
  // preserving the sign for positioning.
  const verticalText = !!style.vertical_text
  const verticalCandidates = !style.horizontal
  if (verticalText) {
    layout.spacing = Math.max(layout.spacing, layout.hilite_padding_x * 2)
    layout.candidate_spacing = Math.max(layout.candidate_spacing, layout.hilite_padding_x * 2)
    if (style.vertical_text_with_wrap) {
      layout.candidate_spacing = Math.max(layout.candidate_spacing, layout.hilite_padding_y * 2)
    }
    if (!style.inline_preedit) {
      layout.hilite_spacing = Math.max(layout.hilite_spacing, layout.hilite_padding_y)
    }
  } else {
    layout.spacing = Math.max(layout.spacing, layout.hilite_padding_y * 2)
    layout.candidate_spacing = Math.max(
      layout.candidate_spacing,
      (verticalCandidates ? layout.hilite_padding_y : layout.hilite_padding_x) * 2,
    )
    if (!style.inline_preedit) {
      layout.hilite_spacing = Math.max(layout.hilite_spacing, layout.hilite_padding_x)
    }
  }
  layout.margin_x = Math.sign(layout.margin_x || 1) * Math.max(Math.abs(layout.margin_x), layout.hilite_padding_x)
  layout.margin_y = Math.sign(layout.margin_y || 1) * Math.max(Math.abs(layout.margin_y), layout.hilite_padding_y)

  style.layout = layout
  return style
}

/** 从 weasel.yaml 文本提取 style + preset_color_schemes */
export function parseWeaselYaml(text) {
  let doc
  try {
    doc = yaml.load(text)
  } catch (e) {
    const msg = e && e.message ? e.message : String(e)
    const mark = e && e.mark ? ` (line ${e.mark.line + 1}, col ${e.mark.column + 1})` : ''
    throw new Error(`YAML 解析失败${mark}：${msg}\n请检查缩进是否对齐、值里的 * # % : 是否已加引号`)
  }
  if (!doc || typeof doc !== 'object') {
    throw new Error('无法解析 YAML')
  }
  let style = normalizeWeaselStyle(doc.style || {})
  const presets = {}
  const schemes = doc.preset_color_schemes || {}
  for (const [id, raw] of Object.entries(schemes)) {
    if (!raw || typeof raw !== 'object') continue
    presets[id] = normalizeScheme(id, raw)
  }

  // weasel.custom.yaml：patch/"style/..." / "preset_color_schemes/id"
  const patch = doc.patch && typeof doc.patch === 'object' ? doc.patch : null
  if (patch) {
    for (const [k, v] of Object.entries(patch)) {
      if (k.startsWith('preset_color_schemes/')) {
        const id = k.slice('preset_color_schemes/'.length)
        if (v && typeof v === 'object') {
          presets[id] = normalizeScheme(id, v)
        }
        continue
      }
      if (k.startsWith('style/')) {
        const path = k.slice('style/'.length)
        if (path.includes('/')) {
          const [a, b] = path.split('/')
          if (!style[a] || typeof style[a] !== 'object') style[a] = {}
          style[a][b] = v
        } else {
          style[path] = v
        }
        continue
      }
      // 嵌套：preset_color_schemes: { id: {...} }
      if (k === 'preset_color_schemes' && v && typeof v === 'object') {
        for (const [id, raw] of Object.entries(v)) {
          if (raw && typeof raw === 'object') {
            presets[id] = normalizeScheme(id, raw)
          }
        }
      }
      if (k === 'style' && v && typeof v === 'object') {
        style = normalizeWeaselStyle({ ...style, ...v, layout: { ...style.layout, ...(v.layout || {}) } })
      }
    }
  }

  return { style: normalizeWeaselStyle(style), presets, rawDoc: doc }
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
  style = normalizeWeaselStyle(style)
  const lines = []
  lines.push('style:')
  lines.push(`  color_scheme: ${JSON.stringify(style.color_scheme || 'custom')}`)
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
  lines.push(`  preedit_type: ${JSON.stringify(style.preedit_type || 'composition')}`)
  lines.push(`  fullscreen: ${!!style.fullscreen}`)
  lines.push(`  horizontal: ${!!style.horizontal}`)
  lines.push(`  vertical_text: ${!!style.vertical_text}`)
  lines.push(`  vertical_text_left_to_right: ${!!style.vertical_text_left_to_right}`)
  lines.push(`  vertical_text_with_wrap: ${!!style.vertical_text_with_wrap}`)
  lines.push(`  vertical_auto_reverse: ${!!style.vertical_auto_reverse}`)
  lines.push(`  label_format: ${JSON.stringify(style.label_format || '%s')}`)
  lines.push(`  mark_text: ${JSON.stringify(style.mark_text || '')}`)
  lines.push(`  hover_type: ${JSON.stringify(style.hover_type || 'none')}`)
  lines.push(`  paging_on_scroll: ${!!style.paging_on_scroll}`)
  lines.push(`  candidate_abbreviate_length: ${style.candidate_abbreviate_length ?? 30}`)
  lines.push(`  antialias_mode: ${JSON.stringify(style.antialias_mode || 'default')}`)
  lines.push(`  display_tray_icon: ${style.display_tray_icon !== false}`)
  lines.push(`  ascii_tip_follow_cursor: ${!!style.ascii_tip_follow_cursor}`)
  lines.push(`  enhanced_position: ${style.enhanced_position !== false}`)
  lines.push(`  click_to_capture: ${!!style.click_to_capture}`)
  lines.push(`  text_orientation: ${JSON.stringify(style.text_orientation || 'horizontal')}`)
  lines.push('  layout:')
  const L = style.layout || {}
  for (const [k, v] of Object.entries(L)) {
    if (k === 'border_width' || k === 'hilited_corner_radius') continue
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


/**
 * 生成 weasel.custom.yaml 补丁（Rime 定製指南推荐方式）
 * 不要直接改 weasel.yaml；用 patch 覆盖 style 与 preset_color_schemes
 *
 * 结构：
 *   patch:
 *     style/color_scheme: "xxx"
 *     style/font_point: 14
 *     style/layout/margin_x: 12
 *     preset_color_schemes/xxx:
 *       name: "..."
 *       ...
 */
export function exportCustomPatchYaml(style, schemes, options = {}) {
  style = normalizeWeaselStyle(style)
  const removeIds = options.removeIds || []
  const lines = []
  lines.push('# 由 Weasel Skin Studio 生成 · weasel.custom.yaml 补丁')
  lines.push('# 依据 Rime 定製指南：用 patch 覆盖，不要直接改 weasel.yaml')
  lines.push('# 改完请「重新部署」使生效')
  lines.push('')
  lines.push('patch:')
  lines.push(`  "style/color_scheme": ${JSON.stringify(String(style.color_scheme || (schemes[0] && schemes[0].id) || 'custom'))}`)

  const styleKeys = [
    'color_scheme_dark',
    'font_face',
    'label_font_face',
    'comment_font_face',
    'font_point',
    'label_font_point',
    'comment_font_point',
    'candidate_abbreviate_length',
    'inline_preedit',
    'preedit_type',
    'fullscreen',
    'horizontal',
    'vertical_text',
    'vertical_text_left_to_right',
    'vertical_text_with_wrap',
    'vertical_auto_reverse',
    'label_format',
    'mark_text',
    'hover_type',
    'paging_on_scroll',
    'antialias_mode',
    'display_tray_icon',
    'ascii_tip_follow_cursor',
    'enhanced_position',
    'click_to_capture',
    'text_orientation',
  ]
  for (const k of styleKeys) {
    const v = style[k]
    if (v == null || v === '') continue
    if (k === 'color_scheme') continue
    const yamlVal =
      typeof v === 'boolean' ? (v ? 'true' : 'false')
        : typeof v === 'number' ? String(v)
          : JSON.stringify(String(v))
    lines.push(`  "style/${k}": ${yamlVal}`)
  }

  const L = style.layout || {}
  for (const [k, v] of Object.entries(L)) {
    if (k === 'border_width' || k === 'hilited_corner_radius') continue
    if (v == null || v === '') continue
    const yamlVal =
      typeof v === 'boolean' ? (v ? 'true' : 'false')
        : typeof v === 'number' ? String(v)
          : JSON.stringify(String(v))
    lines.push(`  "style/layout/${k}": ${yamlVal}`)
  }

  for (const scheme of schemes) {
    if (!scheme || !scheme.id) continue
    lines.push('')
    lines.push(`  "preset_color_schemes/${scheme.id}":`)
    const format = scheme.color_format || 'abgr'
    const inner = '    '
    lines.push(`${inner}name: ${JSON.stringify(String(scheme.name || scheme.id))}`)
    if (scheme.author) lines.push(`${inner}author: ${JSON.stringify(String(scheme.author))}`)
    lines.push(`${inner}color_format: ${format}`)
    for (const field of COLOR_FIELDS) {
      const rgba = scheme.colors && scheme.colors[field.key]
      if (!rgba) continue
      const val = formatWeaselColor(rgba, format)
      lines.push(`${inner}${field.key}: ${val}`)
    }
  }

  // 定製指南：补丁无法直接“删键”，删除用 __set/_remove 约定因版本而异，
  // 这里用列表记录待删 id，配合工具内「从文件删除」或手工从 weasel.yaml 去掉。
  if (removeIds && removeIds.length) {
    lines.push('')
    lines.push('  # 以下方案需从 weasel.yaml / 旧补丁中手工移除（补丁无法删除已有键）：')
    for (const id of removeIds) {
      lines.push(`  # - ${id}`)
    }
  }

  return lines.join('\n') + '\n'
}

/** 解析 weasel.custom.yaml 中我们生成的 patch（尽力读取） */
export function parseCustomPatch(text) {
  const doc = yaml.load(text)
  if (!doc || typeof doc !== 'object') return { schemes: [], style: {} }
  const patch = doc.patch && typeof doc.patch === 'object' ? doc.patch : doc
  const schemes = []
  const style = {}
  for (const [k, v] of Object.entries(patch)) {
    if (k.startsWith('style/')) {
      const path = k.slice('style/'.length)
      if (path.includes('/')) {
        const [a, b] = path.split('/')
        if (!style[a] || typeof style[a] !== 'object') style[a] = {}
        style[a][b] = v
      } else {
        style[path] = v
      }
      continue
    }
    if (k.startsWith('preset_color_schemes/')) {
      const id = k.slice('preset_color_schemes/'.length)
      if (v && typeof v === 'object') {
        schemes.push(normalizeScheme(id, v))
      }
    }
  }
  return { schemes, style }
}
