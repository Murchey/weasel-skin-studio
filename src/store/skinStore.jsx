import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { PRESET_SCHEMES } from '../data/presets.js'
import {
  STYLE_DEFAULTS,
  normalizeWeaselStyle,
  normalizeScheme,
  exportFullYaml,
  exportCustomPatchYaml,
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
  syncSchemeListInWeaselText,
  updateStyleKeysInWeaselText,
} from '../utils/weaselFileEdit.js'

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

const initialFile = () => ({
  handle: null,
  name: '',
  path: '',
  text: '',
  loaded: false,
  writable: false,
  lastSavedAt: null,
  lastAction: '',
})

function initialState() {
  const starter = clone(PRESET_SCHEMES.find((p) => p.id === 'custom') || PRESET_SCHEMES[0])
  starter.source = 'preset'
  return {
    style: normalizeWeaselStyle({ ...STYLE_DEFAULTS, color_scheme: starter.id }),
    // 启动即提供一个可编辑的起点，避免用户第一次打开时面对空白画布。
    schemes: [starter],
    activeSchemeId: starter.id,
    dirty: false,
    stageMode: 'light',
    sampleText: 'xiao lang hao shu ru fa',
    sampleCandidates: [
      { label: '1', text: '小狼毫输入法', comment: '' },
      { label: '2', text: '小狼毫', comment: '' },
      { label: '3', text: 'Weasel', comment: '' },
      { label: '4', text: '小狼', comment: '' },
      { label: '5', text: '小浪', comment: '' },
    ],
    selectedCandidate: 0,
    selectedIds: [],
    pendingRemovals: [],
    studioMode: false,
    file: initialFile(),
  }
}

const SkinContext = createContext(null)

export function SkinProvider({ children }) {
  const [state, setState] = useState(initialState)

  const historyRef = useRef([])
  const stateRef = useRef(null)
  stateRef.current = state

  /** 保存可撤销快照（样式/配色，不含视图态） */
  const pushHistory = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    historyRef.current.push({
      style: clone(s.style),
      schemes: clone(s.schemes),
      activeSchemeId: s.activeSchemeId,
      pendingRemovals: [...(s.pendingRemovals || [])],
    })
    if (historyRef.current.length > 80) historyRef.current.shift()
  }, [])

  const undo = useCallback(() => {
    const snap = historyRef.current.pop()
    if (!snap) return false
    setState((prev) => ({
      ...prev,
      style: snap.style,
      schemes: snap.schemes,
      activeSchemeId: snap.activeSchemeId,
      pendingRemovals: snap.pendingRemovals,
      dirty: true,
    }))
    return true
  }, [])

  const clearHistory = useCallback(() => {
    historyRef.current = []
  }, [])

  const patch = useCallback((updater) => {
    setState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      return next
    })
  }, [])

  const activeScheme = useMemo(() => {
    return (
      state.schemes.find((s) => s.id === state.activeSchemeId) || state.schemes[0] || null
    )
  }, [state.schemes, state.activeSchemeId])

  const colorFormat = activeScheme?.color_format || 'rgba'

  const setColor = useCallback(
    (key, rgba, options = {}) => {
      if (options.history !== false) pushHistory()
      patch((prev) => {
        const schemes = prev.schemes.map((s) => {
          if (s.id !== prev.activeSchemeId) return s
          const colors = { ...s.colors }
          if (rgba == null) delete colors[key]
          else colors[key] = rgba
          return { ...s, colors }
        })
        return { ...prev, schemes, dirty: true }
      })
    },
    [patch],
  )

  const getColor = useCallback(
    (key) => activeScheme?.colors?.[key] || null,
    [activeScheme],
  )

  const cssColor = useCallback(
    (key, fallback = 'transparent') => {
      const c = getColor(key)
      return c ? toCss(c) : fallback
    },
    [getColor],
  )

  const weaselColor = useCallback(
    (key) => {
      const c = getColor(key)
      return c ? formatWeaselColor(c, colorFormat) : '—'
    },
    [getColor, colorFormat],
  )

  const selectScheme = useCallback(
    (id) => {
      patch((prev) => {
        if (!prev.schemes.some((s) => s.id === id)) return prev
        return {
          ...prev,
          activeSchemeId: id,
          style: { ...prev.style, color_scheme: id },
        }
      })
    },
    [patch],
  )

  const setSchemeMeta = useCallback(
    (metaPatch) => {
      pushHistory()
      patch((prev) => {
        let activeSchemeId = prev.activeSchemeId
        let style = prev.style
        const schemes = prev.schemes.map((s) => {
          if (s.id !== prev.activeSchemeId) return s
          const next = { ...s, ...metaPatch }
          if (metaPatch.id && metaPatch.id !== s.id) {
            activeSchemeId = metaPatch.id
            if (prev.style.color_scheme === s.id) {
              style = { ...prev.style, color_scheme: metaPatch.id }
            }
          }
          return next
        })
        return { ...prev, schemes, activeSchemeId, style, dirty: true }
      })
    },
    [patch],
  )

  const setColorFormat = useCallback(
    (format) => {
      pushHistory()
      patch((prev) => {
        const schemes = prev.schemes.map((s) => {
          if (s.id !== prev.activeSchemeId || s.color_format === format) return s
          const migrated = migrateSchemeFormat(s, format)
          return { ...s, color_format: migrated.color_format, colors: migrated.colors }
        })
        return { ...prev, schemes, dirty: true }
      })
    },
    [patch],
  )

  const applyPreset = useCallback(
    (preset) => {
      pushHistory()
      patch((prev) => {
        const copy = clone(preset)
        copy.source = copy.source || 'preset'
        const idx = prev.schemes.findIndex((s) => s.id === preset.id)
        const schemes =
          idx >= 0
            ? prev.schemes.map((s, i) => (i === idx ? copy : s))
            : [...prev.schemes, copy]
        return {
          ...prev,
          schemes,
          activeSchemeId: copy.id,
          style: { ...prev.style, color_scheme: copy.id },
          dirty: true,
        }
      })
    },
    [patch],
  )

  const addScheme = useCallback(
    (fromScheme) => {
      pushHistory()
      const id = `custom_${Date.now().toString(36)}`
      patch((prev) => {
        const base = fromScheme || prev.schemes.find((s) => s.id === prev.activeSchemeId) || PRESET_SCHEMES[0]
        const copy = clone(base)
        copy.id = id
        copy.name = '新建配色'
        copy.author = 'Weasel Skin Studio'
        copy.source = 'local'
        return {
          ...prev,
          schemes: [...prev.schemes, copy],
          activeSchemeId: id,
          style: { ...prev.style, color_scheme: id },
          dirty: true,
        }
      })
      return id
    },
    [patch],
  )

  const removeScheme = useCallback(
    (id) => {
      pushHistory()
      let ok = false
      patch((prev) => {
        if (prev.schemes.length <= 1) return prev
        const idx = prev.schemes.findIndex((s) => s.id === id)
        if (idx < 0) return prev
        ok = true
        const schemes = prev.schemes.filter((s) => s.id !== id)
        const activeSchemeId =
          prev.activeSchemeId === id ? schemes[0].id : prev.activeSchemeId
        const color_scheme =
          prev.activeSchemeId === id ? schemes[0].id : prev.style.color_scheme
        const selectedIds = prev.selectedIds.filter((x) => x !== id)
        // 记录待从 weasel.yaml 删除的方案 id
        const pendingRemovals = prev.pendingRemovals.includes(id)
          ? prev.pendingRemovals
          : [...prev.pendingRemovals, id]
        return {
          ...prev,
          schemes,
          activeSchemeId,
          selectedIds,
          pendingRemovals,
          style: { ...prev.style, color_scheme },
          dirty: true,
        }
      })
      return ok
    },
    [patch],
  )

  const toggleSchemeSelect = useCallback((id) => {
    patch((prev) => {
      const selectedIds = prev.selectedIds.includes(id)
        ? prev.selectedIds.filter((x) => x !== id)
        : [...prev.selectedIds, id]
      return { ...prev, selectedIds }
    })
  }, [patch])

  const clearSchemeSelection = useCallback(() => {
    patch((prev) => ({ ...prev, selectedIds: [] }))
  }, [patch])

  /** 批量删除（列表 + 记入待从文件删除） */
  const removeSchemes = useCallback(
    (ids) => {
      pushHistory()
      const list = Array.isArray(ids) ? ids : [ids]
      patch((prev) => {
        const idSet = new Set(list)
        // 至少保留 1 个
        let schemes = prev.schemes.filter((s) => !idSet.has(s.id))
        if (schemes.length === 0) return prev
        const still = new Set(schemes.map((s) => s.id))
        const activeSchemeId = still.has(prev.activeSchemeId)
          ? prev.activeSchemeId
          : schemes[0].id
        const color_scheme = still.has(prev.style.color_scheme)
          ? prev.style.color_scheme
          : activeSchemeId
        const pendingRemovals = prev.pendingRemovals.slice()
        for (const id of list) {
          if (!pendingRemovals.includes(id)) pendingRemovals.push(id)
        }
        return {
          ...prev,
          schemes,
          activeSchemeId,
          selectedIds: prev.selectedIds.filter((x) => !idSet.has(x)),
          pendingRemovals,
          style: { ...prev.style, color_scheme },
          dirty: true,
        }
      })
    },
    [patch],
  )

  const duplicateScheme = useCallback(
    (id) => {
      pushHistory()
      patch((prev) => {
        const src = prev.schemes.find((s) => s.id === id)
        if (!src) return prev
        const copy = clone(src)
        copy.id = `${src.id}_copy_${Date.now().toString(36)}`
        copy.name = `${src.name} 副本`
        copy.source = 'local'
        return {
          ...prev,
          schemes: [...prev.schemes, copy],
          activeSchemeId: copy.id,
          dirty: true,
        }
      })
    },
    [patch],
  )

  const setStyle = useCallback(
    (key, value) => {
      pushHistory()
      patch((prev) => ({
        ...prev,
        style: normalizeWeaselStyle({ ...prev.style, [key]: value }),
        dirty: true,
      }))
    },
    [patch],
  )

  const setLayout = useCallback(
    (key, value) => {
      pushHistory()
      patch((prev) => ({
        ...prev,
        style: normalizeWeaselStyle({
          ...prev.style,
          layout: { ...prev.style.layout, [key]: value },
        }),
        dirty: true,
      }))
    },
    [patch],
  )

  const importSchemes = useCallback(
    (schemes, stylePatch) => {
      patch((prev) => {
        let list = [...prev.schemes]
        for (const raw of schemes) {
          const scheme = normalizeScheme(raw.id, raw)
          scheme.source = raw.source || 'file'
          const idx = list.findIndex((s) => s.id === scheme.id)
          if (idx >= 0) list[idx] = scheme
          else list.push(scheme)
        }
        return {
          ...prev,
          schemes: list,
          style: stylePatch
            ? normalizeWeaselStyle({ ...prev.style, ...stylePatch, layout: { ...prev.style.layout, ...(stylePatch.layout || {}) } })
            : prev.style,
          activeSchemeId: schemes[0]?.id || prev.activeSchemeId,
          dirty: true,
        }
      })
    },
    [patch],
  )

  const applyRawYaml = useCallback((text) => {
    const parsed = parseWeaselYaml(String(text || ''))
    const schemes = Object.values(parsed.presets).map((s) => ({ ...s, source: 'local' }))
    setState((prev) => {
      const nextSchemes = schemes.length ? schemes : prev.schemes
      const active = nextSchemes.find((s) => s.id === parsed.style.color_scheme) || nextSchemes[0]
      return {
        ...prev,
        style: normalizeWeaselStyle(parsed.style),
        schemes: nextSchemes,
        activeSchemeId: active?.id || prev.activeSchemeId,
        dirty: true,
        file: { ...prev.file, lastAction: '已应用原始 YAML 参数' },
      }
    })
  }, [])

  const resetAll = useCallback(() => {
    setState(initialState())
  }, [])

  const exportAll = useCallback(() => {
    return exportFullYaml(state.style, state.schemes)
  }, [state.style, state.schemes])

  const exportActive = useCallback(() => {
    return [exportStyleYaml(state.style), '', 'preset_color_schemes:', exportSchemeYaml(activeScheme)].join('\n')
  }, [state.style, activeScheme])

  const setSample = useCallback((index) => {
    patch((prev) => ({ ...prev, selectedCandidate: index }))
  }, [patch])

  const setSampleText = useCallback((text) => {
    patch((prev) => ({ ...prev, sampleText: String(text ?? '') }))
  }, [patch])

  const setSampleCandidate = useCallback((index, patchValue) => {
    patch((prev) => {
      const sampleCandidates = prev.sampleCandidates.map((candidate, i) =>
        i === index ? { ...candidate, ...patchValue } : candidate,
      )
      return { ...prev, sampleCandidates }
    })
  }, [patch])

  const setStageMode = useCallback((mode) => {
    patch((prev) => ({ ...prev, stageMode: mode }))
  }, [patch])

  const setStudioMode = useCallback((on) => {
    patch((prev) => ({ ...prev, studioMode: !!on }))
  }, [patch])

  const canWriteFile = useCallback(() => {
    return supportsFileSystemAccess() && !!state.file.handle
  }, [state.file.handle])

  const fileStatus = useCallback(() => {
    return {
      loaded: state.file.loaded,
      writable: canWriteFile(),
      name: state.file.name,
      path: state.file.path,
      dirty: state.dirty,
      lastSavedAt: state.file.lastSavedAt,
      lastAction: state.file.lastAction,
    }
  }, [state.file, state.dirty, canWriteFile])

  const buildSaveText = useCallback(() => {
    if (!state.file.loaded || !state.file.text) {
      throw new Error('请先「打开 weasel.yaml」')
    }
    const s = activeScheme
    // 1) 写入当前配色（已存在则整块替换）
    let text = upsertSchemeInWeaselText(state.file.text, s).text
    // 2) 把文件里的方案列表同步为「界面里还留着的那些」
    //    —— 这样删除过的方案不会在重新打开后又冒出来
    const keepIds = state.schemes.map((x) => x.id)
    const synced = syncSchemeListInWeaselText(text, keepIds)
    text = synced.text
    // 3) 兜底：清理 pendingRemovals（通常已被第 2 步覆盖）
    for (const rid of state.pendingRemovals) {
      text = removeSchemeFromWeaselText(text, rid).text
    }
    // 4) 写回完整 style/layout。此前只写入了少数显示键，导致字体、
    // 边距和阴影等 UI 修改在覆盖源文件时丢失。
    const stylePatch = {
      color_scheme: s.id,
      color_scheme_dark: state.style.color_scheme_dark,
      font_face: state.style.font_face,
      label_font_face: state.style.label_font_face,
      comment_font_face: state.style.comment_font_face,
      font_point: state.style.font_point,
      label_font_point: state.style.label_font_point,
      comment_font_point: state.style.comment_font_point,
      candidate_abbreviate_length: state.style.candidate_abbreviate_length,
      inline_preedit: state.style.inline_preedit,
      preedit_type: state.style.preedit_type,
      fullscreen: state.style.fullscreen,
      horizontal: state.style.horizontal,
      vertical_text: state.style.vertical_text,
      vertical_text_left_to_right: state.style.vertical_text_left_to_right,
      vertical_text_with_wrap: state.style.vertical_text_with_wrap,
      vertical_auto_reverse: state.style.vertical_auto_reverse,
      label_format: state.style.label_format,
      mark_text: state.style.mark_text,
      hover_type: state.style.hover_type,
      paging_on_scroll: state.style.paging_on_scroll,
      antialias_mode: state.style.antialias_mode,
      display_tray_icon: state.style.display_tray_icon,
      ascii_tip_follow_cursor: state.style.ascii_tip_follow_cursor,
      enhanced_position: state.style.enhanced_position,
      click_to_capture: state.style.click_to_capture,
      text_orientation: state.style.text_orientation,
    }
    for (const [key, value] of Object.entries(state.style.layout || {})) {
      if (key === 'border_width' || key === 'hilited_corner_radius') continue
      if (value === '' || value == null) continue
      stylePatch[`layout/${key}`] = value
    }
    text = updateStyleKeysInWeaselText(text, stylePatch).text
    return text
  }, [state.file, state.schemes, state.pendingRemovals, activeScheme, state.style])

  const openWeaselFile = useCallback(async () => {
    const result = await readWeaselFile()
    const parsed = parseWeaselYaml(result.text)
    const schemes = Object.values(parsed.presets).map((s) => ({ ...s, source: 'file' }))
    setState((prev) => {
      const next = {
        ...prev,
        file: {
          handle: result.handle || null,
          name: result.name || 'weasel.yaml',
          path: result.path || result.name || '',
          text: result.text,
          loaded: true,
          writable: !!result.handle,
          lastSavedAt: null,
          lastAction: schemes.length
            ? (result.handle
                ? `已打开 · ${schemes.length} 个方案 · 可写`
                : `已打开 · ${schemes.length} 个方案 · 只读`)
            : `已打开 · 文件内无配色方案 · 可点左侧「预设」添加`,
        },
        dirty: false,
        studioMode: true,
        // 重新打开文件时丢弃未写入的删除记录，避免与文件内容错位
        pendingRemovals: [],
      }
      if (schemes.length) {
        next.schemes = schemes
          next.style = normalizeWeaselStyle(parsed.style)
        const preferred = schemes.find((s) => s.id === parsed.style.color_scheme) || schemes[0]
        next.activeSchemeId = preferred.id
      } else {
        // 空文件：明确告知，不要静默塞入内置预设
        next.file = {
          ...next.file,
          lastAction: '文件中没有配色方案，可从左侧预设添加',
        }
      }
      return next
    })
    return fileStatus()
  }, [fileStatus])

  const saveToWeaselFile = useCallback(async () => {
    if (!state.file.loaded || !state.file.text) {
      throw new Error('请先「打开 weasel.yaml」')
    }
    const s = activeScheme
    const text = buildSaveText()
    const idx = state.schemes.findIndex((x) => x.id === s.id)
    const schemes = state.schemes.map((x, i) =>
      i === idx ? { ...x, source: 'file' } : x,
    )

    if (canWriteFile()) {
      await writeWeaselFile(state.file.handle, text)
      setState((prev) => ({
        ...prev,
        schemes,
        file: {
          ...prev.file,
          text,
          lastSavedAt: new Date().toISOString(),
          lastAction: `已保存「${s.id}」`,
        },
        dirty: false,
        pendingRemovals: [],
      }))
      return { ok: true, written: true, needsDownload: false, schemeId: s.id }
    }

    setState((prev) => ({
      ...prev,
      schemes,
      file: {
        ...prev.file,
        text,
        lastAction: `内存副本已更新「${s.id}」`,
      },
      dirty: true,
    }))
    return { ok: true, written: false, needsDownload: true, schemeId: s.id }
  }, [state.file, activeScheme, state.schemes, buildSaveText, canWriteFile])

  const previewSaveText = useCallback(() => {
    return { text: buildCustomPatch(), schemeId: activeScheme.id }
  }, [buildCustomPatch, activeScheme])

  const removeSchemeFromFile = useCallback(
    async (schemeId) => {
      if (!state.file.loaded || !state.file.text) {
        throw new Error('请先「打开 weasel.yaml」')
      }
      const { text, action } = removeSchemeFromWeaselText(state.file.text, schemeId)
      if (action === 'missing') throw new Error(`文件中未找到方案 ${schemeId}`)
      const writable = canWriteFile()
      if (writable) {
        await writeWeaselFile(state.file.handle, text)
      }
      setState((prev) => {
        const schemes = prev.schemes.filter((s) => s.id !== schemeId)
        const activeSchemeId =
          prev.activeSchemeId === schemeId && schemes[0]
            ? schemes[0].id
            : prev.activeSchemeId
        return {
          ...prev,
          schemes,
          activeSchemeId,
          dirty: !writable,
          file: {
            ...prev.file,
            text,
            lastSavedAt: writable ? new Date().toISOString() : prev.file.lastSavedAt,
            lastAction: writable ? `已删除「${schemeId}」` : `内存已删除「${schemeId}」`,
          },
        }
      })
      return { action, written: writable }
    },
    [state.file, canWriteFile],
  )

  const exportWeaselCopy = useCallback(async () => {
    const name = state.file.loaded ? state.file.name || 'weasel.yaml' : 'weasel.yaml'
    const text = state.file.loaded ? state.file.text || exportAll() : exportAll()
    await downloadWeaselFile(name, text)
    setState((prev) => ({
      ...prev,
      file: { ...prev.file, lastAction: '已下载 weasel.yaml 副本' },
    }))
  }, [state.file, exportAll])

  const exportSkinYaml = useCallback(async () => {
    await downloadWeaselFile('weasel-skin.yaml', exportAll())
    setState((prev) => ({
      ...prev,
      file: { ...prev.file, lastAction: '已导出 weasel-skin.yaml' },
    }))
  }, [exportAll])

  const buildCustomPatch = useCallback(() => {
    return exportCustomPatchYaml(state.style, state.schemes, {
      removeIds: state.pendingRemovals,
    })
  }, [state.style, state.schemes, state.pendingRemovals])

  /**
   * 按 Rime 定製指南：默认写 weasel.custom.yaml 补丁，不直接改 weasel.yaml。
   * - 若已打开 weasel.custom.yaml → 写回该文件
   * - 若已打开同目录 weasel.yaml → 尝试写同目录 weasel.custom.yaml
   * - 否则另存为 weasel.custom.yaml
   */
  const saveCustomPatch = useCallback(async () => {
    const text = buildCustomPatch()
    let targetName = 'weasel.custom.yaml'
    let path = null

    if (state.file.loaded && state.file.path) {
      const p = String(state.file.path)
      if (/weasel\.custom\.ya?ml$/i.test(p)) {
        path = p
      } else if (/weasel\.ya?ml$/i.test(p)) {
        path = p.replace(/weasel\.ya?ml$/i, 'weasel.custom.yaml')
      }
    }

    const tauriPathWrite = typeof state.file.handle === 'string'
    if (path && tauriPathWrite) {
      // 用路径直接写（Tauri handle 是 path 字符串）
      await writeWeaselFile(path, text)
      setState((prev) => ({
        ...prev,
        file: {
          ...prev.file,
          lastAction: '已写入 weasel.custom.yaml 补丁',
          lastSavedAt: new Date().toISOString(),
        },
        pendingRemovals: [],
        dirty: false,
      }))
      return { ok: true, written: true, needsDownload: false, patched: true, path }
    }

    const ok = await downloadWeaselFile(targetName, text)
    setState((prev) => ({
      ...prev,
      file: {
        ...prev.file,
        lastAction: ok ? '已导出 weasel.custom.yaml' : '已取消导出',
      },
    }))
    return { ok: !!ok, written: false, needsDownload: !ok, exported: true, patched: true }
  }, [buildCustomPatch, state.file])

  /** 覆盖当前已打开的源文件 */
  const overwriteSource = useCallback(async () => {
    if (!state.file.loaded || !state.file.text) {
      throw new Error('尚未打开源文件，无法覆盖')
    }
    const path = String(state.file.path || state.file.name || '')
    const isCustom = /weasel\.custom\.ya?ml$/i.test(path) ||
      /^\s*patch\s*:/m.test(state.file.text || '')

    if (isCustom) {
      // weasel.custom.yaml：整份重写为 patch（Rime 定製指南）
      const text = buildCustomPatch()
      if (!canWriteFile()) {
        throw new Error('当前文件只读，无法覆盖')
      }
      await writeWeaselFile(state.file.handle, text)
      setState((prev) => ({
        ...prev,
        file: {
          ...prev.file,
          text,
          lastSavedAt: new Date().toISOString(),
          lastAction: '已覆盖 weasel.custom.yaml',
        },
        dirty: false,
        pendingRemovals: [],
      }))
      return { ok: true, written: true, needsDownload: false, patched: true }
    }

    return saveToWeaselFile()
  }, [state.file, saveToWeaselFile, buildCustomPatch, canWriteFile])

  /** 另存为：写完整 YAML 或补丁到用户指定位置 */
  const saveAsFile = useCallback(async (kind = 'patch') => {
    const text =
      kind === 'full' ? exportAll() : buildCustomPatch()
    const defaultName =
      kind === 'full' ? 'weasel-skin.yaml' : 'weasel.custom.yaml'
    const ok = await downloadWeaselFile(defaultName, text)
    setState((prev) => ({
      ...prev,
      file: {
        ...prev.file,
        lastAction: ok ? `已另存 ${defaultName}` : '已取消另存',
      },
    }))
    return { ok: !!ok, written: false, exported: true, savedAs: ok ? defaultName : null }
  }, [exportAll, buildCustomPatch])

  /** 兼容：优先补丁，失败/无路径再导出片段 */
  const saveSchemes = useCallback(async () => {
    try {
      return await saveCustomPatch()
    } catch (e) {
      const msg = e && e.message ? e.message : String(e)
      if (String(msg).includes('YAML')) throw e
      const ok = await downloadWeaselFile('weasel-skin.yaml', exportAll())
      return {
        ok: !!ok,
        written: false,
        exported: true,
        schemeId: activeScheme?.id,
      }
    }
  }, [saveCustomPatch, exportAll, activeScheme])

  const value = useMemo(
    () => ({
      state,
      activeScheme,
      colorFormat,
      setColor,
      getColor,
      cssColor,
      weaselColor,
      selectScheme,
      setSchemeMeta,
      undo,
      clearHistory,
      setColorFormat,
      applyPreset,
      addScheme,
      removeScheme,
      removeSchemes,
      toggleSchemeSelect,
      clearSchemeSelection,
      duplicateScheme,
      setStyle,
      setLayout,
      setStageMode,
      importSchemes,
      applyRawYaml,
      resetAll,
      exportAll,
      exportActive,
      setSample,
      setSampleText,
      setSampleCandidate,
      setStudioMode,
      openWeaselFile,
      saveToWeaselFile,
      previewSaveText,
      removeSchemeFromFile,
      exportWeaselCopy,
      exportSkinYaml,
      saveCustomPatch,
      buildCustomPatch,
      overwriteSource,
      saveAsFile,
      saveSchemes,
      canWriteFile,
      fileStatus,
    }),
    [
      state,
      activeScheme,
      colorFormat,
      setColor,
      getColor,
      cssColor,
      weaselColor,
      selectScheme,
      setSchemeMeta,
      undo,
      clearHistory,
      setColorFormat,
      applyPreset,
      addScheme,
      removeScheme,
      removeSchemes,
      toggleSchemeSelect,
      clearSchemeSelection,
      duplicateScheme,
      setStyle,
      setLayout,
      setStageMode,
      importSchemes,
      applyRawYaml,
      resetAll,
      exportAll,
      exportActive,
      setSample,
      setSampleText,
      setSampleCandidate,
      setStudioMode,
      openWeaselFile,
      saveToWeaselFile,
      previewSaveText,
      removeSchemeFromFile,
      exportWeaselCopy,
      exportSkinYaml,
      saveCustomPatch,
      buildCustomPatch,
      overwriteSource,
      saveAsFile,
      saveSchemes,
      canWriteFile,
      fileStatus,
    ],
  )

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>
}

export function useSkin() {
  const ctx = useContext(SkinContext)
  if (!ctx) throw new Error('useSkin must be used within SkinProvider')
  return ctx
}
