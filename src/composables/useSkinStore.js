import { reactive, computed } from 'vue'
import { PRESET_SCHEMES } from '../data/presets.js'
import {
  STYLE_DEFAULTS,
  normalizeScheme,
  exportFullYaml,
  exportSchemeYaml,
  exportStyleYaml,
  migrateSchemeFormat,
  parseWeaselYaml,
} from '../utils/weaselYaml.js'
import { formatWeaselColor, toCss } from '../utils/color.js'
import {
  readWeaselFile,
  writeWeaselFile,
  downloadWeaselFile,
  supportsFileSystemAccess,
} from '../utils/fileAccess.js'
import {
  upsertSchemeInWeaselText,
  removeSchemeFromWeaselText,
  updateStyleKeysInWeaselText,
} from '../utils/weaselFileEdit.js'

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

const state = reactive({
  style: clone(STYLE_DEFAULTS),
  schemes: clone(PRESET_SCHEMES),
  activeSchemeId: 'custom',
  dirty: false,
  stageMode: 'light',
  sampleText: 'zhongwen',
  sampleCandidates: [
    { label: '1', text: '中文', comment: 'zhōng wén' },
    { label: '2', text: '终文', comment: '' },
    { label: '3', text: '中文输入法', comment: 'rime' },
    { label: '4', text: '重文', comment: '' },
    { label: '5', text: '钟文', comment: '' },
  ],
  selectedCandidate: 0,

  studioMode: false,
  file: {
    handle: null,
    name: '',
    path: '',
    text: '',
    loaded: false,
    writable: false,
    lastSavedAt: null,
    lastAction: '',
  },
})

export function useSkinStore() {
  const activeScheme = computed(() => {
    return state.schemes.find((s) => s.id === state.activeSchemeId) || state.schemes[0]
  })

  const colorFormat = computed(() => activeScheme.value?.color_format || 'rgba')

  function setColor(key, rgba) {
    const scheme = activeScheme.value
    if (!scheme) return
    if (rgba == null) delete scheme.colors[key]
    else scheme.colors[key] = rgba
    state.dirty = true
  }

  function getColor(key) {
    return activeScheme.value?.colors?.[key] || null
  }

  function cssColor(key, fallback = 'transparent') {
    const c = getColor(key)
    return c ? toCss(c) : fallback
  }

  function weaselColor(key) {
    const c = getColor(key)
    return c ? formatWeaselColor(c, colorFormat.value) : '—'
  }

  function setSchemeMeta(patch) {
    const scheme = activeScheme.value
    if (!scheme) return
    if (patch.id && patch.id !== scheme.id) {
      state.activeSchemeId = patch.id
      if (state.style.color_scheme === scheme.id) state.style.color_scheme = patch.id
    }
    Object.assign(scheme, patch)
    state.dirty = true
  }

  function setColorFormat(format) {
    const scheme = activeScheme.value
    if (!scheme || scheme.color_format === format) return
    const migrated = migrateSchemeFormat(scheme, format)
    scheme.color_format = migrated.color_format
    scheme.colors = migrated.colors
    state.dirty = true
  }

  function applyPreset(preset) {
    const idx = state.schemes.findIndex((s) => s.id === preset.id)
    const copy = clone(preset)
    copy.source = copy.source || 'preset'
    if (idx >= 0) state.schemes.splice(idx, 1, copy)
    else state.schemes.push(copy)
    state.activeSchemeId = copy.id
    state.style.color_scheme = copy.id
    state.dirty = true
  }

  function addScheme(fromScheme) {
    const base = fromScheme || activeScheme.value
    const id = `custom_${Date.now().toString(36)}`
    const copy = clone(base || PRESET_SCHEMES[0])
    copy.id = id
    copy.name = '新建配色'
    copy.author = 'Weasel Skin Studio'
    copy.source = 'local'
    state.schemes.push(copy)
    state.activeSchemeId = id
    state.style.color_scheme = id
    state.dirty = true
    return copy
  }

  function removeScheme(id) {
    if (state.schemes.length <= 1) return false
    const idx = state.schemes.findIndex((s) => s.id === id)
    if (idx < 0) return false
    state.schemes.splice(idx, 1)
    if (state.activeSchemeId === id) {
      state.activeSchemeId = state.schemes[0].id
      state.style.color_scheme = state.schemes[0].id
    }
    state.dirty = true
    return true
  }

  function duplicateScheme(id) {
    const src = state.schemes.find((s) => s.id === id)
    if (!src) return null
    const copy = clone(src)
    copy.id = `${src.id}_copy_${Date.now().toString(36)}`
    copy.name = `${src.name} 副本`
    copy.source = 'local'
    state.schemes.push(copy)
    state.activeSchemeId = copy.id
    state.dirty = true
    return copy
  }

  function setStyle(key, value) {
    state.style[key] = value
    state.dirty = true
  }

  function setLayout(key, value) {
    state.style.layout[key] = value
    state.dirty = true
  }

  function importSchemes(schemes, stylePatch) {
    for (const raw of schemes) {
      const scheme = normalizeScheme(raw.id, raw)
      scheme.source = raw.source || 'file'
      const idx = state.schemes.findIndex((s) => s.id === scheme.id)
      if (idx >= 0) state.schemes.splice(idx, 1, scheme)
      else state.schemes.push(scheme)
    }
    if (stylePatch) Object.assign(state.style, stylePatch)
    if (schemes[0]) state.activeSchemeId = schemes[0].id
    state.dirty = true
  }

  function resetAll() {
    state.style = clone(STYLE_DEFAULTS)
    state.schemes = clone(PRESET_SCHEMES)
    state.activeSchemeId = 'custom'
    state.dirty = false
    state.file = {
      handle: null,
      name: '',
      path: '',
      text: '',
      loaded: false,
      writable: false,
      lastSavedAt: null,
      lastAction: '',
    }
    state.studioMode = false
  }

  function exportAll() {
    return exportFullYaml(state.style, state.schemes)
  }

  function exportActive() {
    const scheme = activeScheme.value
    return [exportStyleYaml(state.style), '', 'preset_color_schemes:', exportSchemeYaml(scheme)].join('\n')
  }

  function setSample(index) {
    state.selectedCandidate = index
  }

  function setStudioMode(on) {
    state.studioMode = !!on
  }

  // ========== 文件流：打开 → 保存 / 导出 ==========

  function ensureFileLoaded() {
    if (!state.file.loaded || !state.file.text) {
      throw new Error('请先「打开 weasel.yaml」')
    }
  }

  function canWriteFile() {
    return supportsFileSystemAccess() && !!state.file.handle
  }

  function fileStatus() {
    return {
      loaded: state.file.loaded,
      writable: canWriteFile(),
      name: state.file.name,
      path: state.file.path,
      dirty: state.dirty,
      lastSavedAt: state.file.lastSavedAt,
      lastAction: state.file.lastAction,
    }
  }

  /** 打开（绑定）weasel.yaml：可写句柄优先，否则只读 */
  async function openWeaselFile() {
    const result = await readWeaselFile()
    state.file.handle = result.handle || null
    state.file.name = result.name || 'weasel.yaml'
    state.file.path = result.path || result.name || ''
    state.file.text = result.text
    state.file.loaded = true
    state.file.writable = !!result.handle
    state.file.lastSavedAt = null
    state.file.lastAction = result.handle ? '已打开 · 可写' : '已打开 · 只读'

    const parsed = parseWeaselYaml(result.text)
    const schemes = Object.values(parsed.presets).map((s) => ({ ...s, source: 'file' }))
    if (schemes.length) {
      state.schemes = schemes
      state.style = {
        ...STYLE_DEFAULTS,
        ...parsed.style,
        layout: { ...STYLE_DEFAULTS.layout, ...(parsed.style.layout || {}) },
      }
      const preferred = schemes.find((s) => s.id === parsed.style.color_scheme) || schemes[0]
      state.activeSchemeId = preferred.id
    }
    state.dirty = false
    state.studioMode = true
    return fileStatus()
  }

  /** 生成保存后的完整 weasel 文本（当前配色 + style 关键项） */
  function buildSaveText() {
    ensureFileLoaded()
    const s = activeScheme.value
    let text = upsertSchemeInWeaselText(state.file.text, s).text
    text = updateStyleKeysInWeaselText(text, {
      color_scheme: s.id,
      font_point: state.style.font_point,
      label_font_point: state.style.label_font_point,
      comment_font_point: state.style.comment_font_point,
      horizontal: state.style.horizontal,
      vertical_text: state.style.vertical_text,
      inline_preedit: state.style.inline_preedit,
      label_format: state.style.label_format,
      mark_text: state.style.mark_text,
    }).text
    return text
  }

  /**
   * 保存：当前配色 + style → 已打开的 weasel.yaml
   * 可写则写回；只读则更新内存并提示下载
   */
  async function saveToWeaselFile() {
    ensureFileLoaded()
    const s = activeScheme.value
    const text = buildSaveText()
    state.file.text = text

    const idx = state.schemes.findIndex((x) => x.id === s.id)
    if (idx >= 0) state.schemes[idx].source = 'file'

    if (canWriteFile()) {
      await writeWeaselFile(state.file.handle, text)
      state.file.lastSavedAt = new Date().toISOString()
      state.file.lastAction = `已保存「${s.id}」`
      state.dirty = false
      return { ok: true, written: true, needsDownload: false, schemeId: s.id }
    }

    state.file.lastAction = `内存副本已更新「${s.id}」`
    state.dirty = true
    return { ok: true, written: false, needsDownload: true, schemeId: s.id }
  }

  /** 预览将写入的文本（不落盘） */
  function previewSaveText() {
    return { text: buildSaveText(), schemeId: activeScheme.value.id }
  }

  /** 从文件删除方案 */
  async function removeSchemeFromFile(schemeId) {
    ensureFileLoaded()
    const { text, action } = removeSchemeFromWeaselText(state.file.text, schemeId)
    if (action === 'missing') throw new Error(`文件中未找到方案 ${schemeId}`)
    state.file.text = text
    if (canWriteFile()) {
      await writeWeaselFile(state.file.handle, state.file.text)
      state.file.lastSavedAt = new Date().toISOString()
      state.file.lastAction = `已删除「${schemeId}」`
    } else {
      state.file.lastAction = `内存已删除「${schemeId}」`
    }
    removeScheme(schemeId)
    return { action, written: canWriteFile() }
  }

  /** 下载当前 weasel.yaml 文本副本 */
  async function exportWeaselCopy() {
    const name = state.file.loaded ? state.file.name || 'weasel.yaml' : 'weasel.yaml'
    const text = state.file.loaded ? state.file.text || exportAll() : exportAll()
    await downloadWeaselFile(name, text)
    state.file.lastAction = '已下载 weasel.yaml 副本'
  }

  /** 下载皮肤片段 YAML（可粘贴进 weasel.yaml） */
  async function exportSkinYaml() {
    await downloadWeaselFile('weasel-skin.yaml', exportAll())
    state.file.lastAction = '已导出 weasel-skin.yaml'
  }

  return {
    state,
    activeScheme,
    colorFormat,
    setColor,
    getColor,
    cssColor,
    weaselColor,
    setSchemeMeta,
    setColorFormat,
    applyPreset,
    addScheme,
    removeScheme,
    duplicateScheme,
    setStyle,
    setLayout,
    importSchemes,
    resetAll,
    exportAll,
    exportActive,
    setSample,
    setStudioMode,
    openWeaselFile,
    saveToWeaselFile,
    previewSaveText,
    removeSchemeFromFile,
    exportWeaselCopy,
    exportSkinYaml,
    canWriteFile,
    fileStatus,
  }
}

let store = null
export function getSkinStore() {
  if (!store) store = useSkinStore()
  return store
}
