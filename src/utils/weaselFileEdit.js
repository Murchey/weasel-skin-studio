import { formatWeaselColor } from './color.js'
import { COLOR_FIELDS } from './weaselYaml.js'

/**
 * 在尽量保留原文件注释/结构的前提下，对 weasel.yaml 做外科式修改：
 * - 追加配色方案到 preset_color_schemes
 * - 替换已有配色方案块
 * - 更新 style 段中的 color_scheme 等键
 */

function indentOf(line) {
  const m = line.match(/^(\s*)/)
  return m ? m[1] : ''
}

/** 找到顶层键的起止行（含键行，不含下一个同级键） */
export function findTopLevelKeyRange(lines, key) {
  const keyRe = new RegExp(`^${key}\\s*:`)
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (keyRe.test(lines[i])) {
      start = i
      break
    }
  }
  if (start < 0) return null

  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim() || line.trim().startsWith('#')) continue
    const ind = indentOf(line)
    if (ind === '' && /^[A-Za-z_][\w-]*\s*:/.test(line)) {
      end = i
      break
    }
  }
  return { start, end }
}

/** 在 preset_color_schemes 下定位某个 scheme 块 */
export function findSchemeRange(lines, schemeId) {
  const preset = findTopLevelKeyRange(lines, 'preset_color_schemes')
  if (!preset) return null

  const schemeRe = new RegExp(`^(\\s+)${escapeReg(schemeId)}\\s*:`)
  let start = -1
  let indent = '  '
  for (let i = preset.start + 1; i < preset.end; i++) {
    const m = lines[i].match(schemeRe)
    if (m) {
      start = i
      indent = m[1]
      break
    }
  }
  if (start < 0) return null

  let end = preset.end
  for (let i = start + 1; i < preset.end; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    // 同级 scheme 或注释行后遇到更浅缩进
    const ind = indentOf(line)
    if (ind.length < indent.length) {
      end = i
      break
    }
    if (ind.length === indent.length && /^[A-Za-z_][\w-]*\s*:/.test(line.trim()) && !line.trim().startsWith('#')) {
      // 同级新键（下一个 scheme）
      end = i
      break
    }
  }
  return { start, end, indent }
}

function escapeReg(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 生成 scheme 的 YAML 行（不含外层缩进，indent 为方案 id 行缩进） */
export function schemeToYamlLines(scheme, indent = '  ') {
  const format = scheme.color_format || 'abgr'
  const inner = indent + '  '
  const lines = []
  lines.push(`${indent}${scheme.id}:`)
  lines.push(`${inner}name: "${String(scheme.name || scheme.id).replace(/"/g, '\\"')}"`)
  if (scheme.author) lines.push(`${inner}author: ${scheme.author}`)
  lines.push(`${inner}color_format: ${format}`)
  for (const field of COLOR_FIELDS) {
    const rgba = scheme.colors?.[field.key]
    if (!rgba) continue
    const val = formatWeaselColor(rgba, format)
    lines.push(`${inner}${field.key}: ${val}`)
  }
  return lines
}

/**
 * 追加配色方案；若 id 已存在则替换该块
 * @returns {{ text: string, action: 'appended'|'replaced'|'created-section' }}
 */
export function upsertSchemeInWeaselText(originalText, scheme) {
  const lines = originalText.split(/\r?\n/)
  const existing = findSchemeRange(lines, scheme.id)

  if (existing) {
    const block = schemeToYamlLines(scheme, existing.indent)
    const next = [...lines.slice(0, existing.start), ...block, ...lines.slice(existing.end)]
    return { text: next.join('\n'), action: 'replaced' }
  }

  // 追加到 preset_color_schemes 末尾
  let preset = findTopLevelKeyRange(lines, 'preset_color_schemes')
  if (!preset) {
    // 文件没有该段，则追加
    const add = ['', 'preset_color_schemes:', ...schemeToYamlLines(scheme, '  '), '']
    return { text: originalText + (originalText.endsWith('\n') ? '' : '\n') + add.join('\n'), action: 'created-section' }
  }

  // 找到段内最后一个非空行，在其后插入
  let insertAt = preset.end
  while (insertAt > preset.start + 1 && !lines[insertAt - 1].trim()) {
    insertAt--
  }
  // 保留段末原缩进风格
  const indent = '  '
  const block = ['', ...schemeToYamlLines(scheme, indent)]
  const next = [...lines.slice(0, insertAt), ...block, ...lines.slice(insertAt)]
  return { text: next.join('\n'), action: 'appended' }
}

/** 删除 scheme 块 */
export function removeSchemeFromWeaselText(originalText, schemeId) {
  const lines = originalText.split(/\r?\n/)
  const range = findSchemeRange(lines, schemeId)
  if (!range) return { text: originalText, action: 'missing' }
  const next = [...lines.slice(0, range.start), ...lines.slice(range.end)]
  return { text: next.join('\n'), action: 'removed' }
}

/**
 * 把 preset_color_schemes 同步为「只保留 keepIds」。
 * 删除文件里存在但不在 keepIds 中的方案，避免删过的方案再次打开又出现。
 * @param {string} originalText
 * @param {string[]} keepIds 要保留的方案 id
 * @returns {{ text: string, removed: string[] }}
 */
export function syncSchemeListInWeaselText(originalText, keepIds) {
  const keep = new Set(keepIds)
  const lines = originalText.split(/\r?\n/)
  const preset = findTopLevelKeyRange(lines, 'preset_color_schemes')
  if (!preset) return { text: originalText, removed: [] }

  // 方案 id 是 preset_color_schemes 的直接子键（二级缩进）
  const idRe = /^(\s+)([^\s#][^:]*?)\s*:/
  const found = []
  let baseIndent = null
  for (let i = preset.start + 1; i < preset.end; i++) {
    const line = lines[i]
    if (!line.trim() || line.trim().startsWith('#')) continue
    const m = line.match(idRe)
    if (!m) continue
    const ind = m[1]
    if (baseIndent === null) baseIndent = ind
    if (ind !== baseIndent) continue
    found.push(m[2].trim())
  }

  const removed = []
  let text = originalText
  // 从后往前删，避免行号漂移
  for (const id of found.filter((id) => !keep.has(id)).reverse()) {
    const ls = text.split(/\r?\n/)
    const r = findSchemeRange(ls, id)
    if (!r) continue
    text = [...ls.slice(0, r.start), ...ls.slice(r.end)].join('\n')
    removed.push(id)
  }
  return { text, removed }
}

/** 更新 style 段中的若干键（不重写整个 style，尽量保注释） */
export function updateStyleKeysInWeaselText(originalText, patch) {
  const lines = originalText.split(/\r?\n/)
  const styleRange = findTopLevelKeyRange(lines, 'style')
  if (!styleRange) {
    const block = ['style:']
    const layoutEntries = []
    for (const [k, v] of Object.entries(patch)) {
      if (k.startsWith('layout/')) layoutEntries.push([k.slice('layout/'.length), v])
      else block.push(`  ${k}: ${formatYamlScalar(v)}`)
    }
    if (layoutEntries.length) {
      block.push('  layout:')
      for (const [k, v] of layoutEntries) block.push(`    ${k}: ${formatYamlScalar(v)}`)
    }
    block.push('')
    return { text: originalText + (originalText.endsWith('\n') ? '' : '\n') + block.join('\n'), action: 'created-style' }
  }

  const before = lines.slice(0, styleRange.start + 1)
  const body = lines.slice(styleRange.start + 1, styleRange.end)
  const after = lines.slice(styleRange.end)

  const scalarPatch = {}
  const layoutPatch = {}
  for (const [key, value] of Object.entries(patch)) {
    if (key.startsWith('layout/')) layoutPatch[key.slice('layout/'.length)] = value
    else scalarPatch[key] = value
  }
  const patchKeys = new Set(Object.keys(scalarPatch))
  const rewritten = []
  const seen = new Set()

  for (const line of body) {
    const m = line.match(/^(\s+)([A-Za-z_][\w-]*)\s*:/)
    if (m && patchKeys.has(m[2])) {
      seen.add(m[2])
      const comment = extractTrailingComment(line)
      rewritten.push(`${m[1]}${m[2]}: ${formatYamlScalar(scalarPatch[m[2]])}${comment ? '  ' + comment : ''}`)
    } else {
      rewritten.push(line)
    }
  }

  for (const [k, v] of Object.entries(scalarPatch)) {
    if (!seen.has(k)) {
      rewritten.push(`  ${k}: ${formatYamlScalar(v)}`)
    }
  }

  if (Object.keys(layoutPatch).length) {
    let layoutStart = -1
    let layoutIndent = '  '
    for (let i = 0; i < rewritten.length; i++) {
      const m = rewritten[i].match(/^(\s*)layout\s*:\s*$/)
      if (m) {
        layoutStart = i
        layoutIndent = m[1] || '  '
        break
      }
    }

    if (layoutStart < 0) {
      rewritten.push(`${'  '}layout:`)
      for (const [key, value] of Object.entries(layoutPatch)) {
        rewritten.push(`${'    '}${key}: ${formatYamlScalar(value)}`)
      }
    } else {
      let layoutEnd = rewritten.length
      for (let i = layoutStart + 1; i < rewritten.length; i++) {
        const line = rewritten[i]
        if (!line.trim() || line.trim().startsWith('#')) continue
        const indent = indentOf(line)
        if (indent.length <= layoutIndent.length) {
          layoutEnd = i
          break
        }
      }
      const layoutBody = rewritten.slice(layoutStart + 1, layoutEnd)
      const seenLayout = new Set()
      const nextLayout = layoutBody.map((line) => {
        const m = line.match(/^(\s+)([A-Za-z_][\w-]*)\s*:/)
        if (!m || !(m[2] in layoutPatch)) return line
        seenLayout.add(m[2])
        const comment = extractTrailingComment(line)
        return `${m[1]}${m[2]}: ${formatYamlScalar(layoutPatch[m[2]])}${comment ? '  ' + comment : ''}`
      })
      for (const [key, value] of Object.entries(layoutPatch)) {
        if (!seenLayout.has(key)) nextLayout.push(`${layoutIndent}  ${key}: ${formatYamlScalar(value)}`)
      }
      rewritten.splice(layoutStart + 1, layoutEnd - layoutStart - 1, ...nextLayout)
    }
  }

  return {
    text: [...before, ...rewritten, ...after].join('\n'),
    action: 'updated-style',
  }
}

function extractTrailingComment(line) {
  // 粗略提取行尾注释（避免截断引号内 #）
  let inSingle = false
  let inDouble = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === "'" && !inDouble) inSingle = !inSingle
    else if (ch === '"' && !inSingle) inDouble = !inDouble
    else if (ch === '#' && !inSingle && !inDouble) {
      // 前面要有空白或行首
      if (i === 0 || /\s/.test(line[i - 1])) {
        return line.slice(i)
      }
    }
  }
  return ''
}

function formatYamlScalar(v) {
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (v == null) return '""'
  // 字符串一律加引号：避免 %s、*、#、: 等被 YAML 误解析
  return JSON.stringify(String(v))
}

/** 设置 style.color_scheme 为当前方案 id */
export function setActiveColorSchemeInText(text, schemeId) {
  return updateStyleKeysInWeaselText(text, { color_scheme: schemeId })
}
