import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Dropdown,
  Input,
  RadioGroup,
  Tabs,
} from '@heroui/react'
import { Radio } from '@heroui/react'
import appIcon from '../assets/app-icon.svg'
import ColorField from './ColorField.jsx'
import NativePreview from './NativePreview.jsx'
import { SkinProvider, useSkin } from '../store/skinStore.jsx'
import { useThemeMode } from '../hooks/useThemeMode.js'
import { InspectProvider, InspectLabel } from '../hooks/useInspect.jsx'
import { ToastProvider, useToast } from '../hooks/useToast.jsx'
import { useUnsavedExitGuard } from '../hooks/useUnsavedExitGuard.js'
import { usePanelWidth, PanelResizer } from '../hooks/usePanelWidth.jsx'
import { COLOR_FIELDS, COLOR_GROUPS } from '../utils/weaselYaml.js'
import { PRESET_SCHEMES } from '../data/presets.js'
import { toCss } from '../utils/color.js'
import { exportSchemeYaml } from '../utils/weaselYaml.js'

const groupOrder = ['window', 'preedit', 'candidate', 'comment', 'hilited', 'paging']
const BASIC_COLOR_KEYS = [
  'back_color', 'border_color', 'text_color', 'candidate_text_color',
  'label_color', 'comment_text_color', 'hilited_candidate_back_color',
  'hilited_candidate_text_color', 'hilited_label_color',
  'hilited_comment_text_color', 'hilited_mark_color',
]

function RangeRow({ label, value, min, max, unit = 'px', onChange, inspectKey }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <InspectLabel
        target={inspectKey || label}
        className="w-24 shrink-0 cursor-help text-xs app-muted"
      >
        {label}
      </InspectLabel>
      <input
        type="range"
        className="h-1.5 flex-1"
        style={{ accentColor: 'var(--accent)' }}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="mono w-12 text-right text-[11px] app-muted">
        {value}
        {unit}
      </span>
    </div>
  )
}

function NumberRow({ label, value, min, max, step = 1, unit = 'px', onChange, inspectKey }) {
  return (
    <FormRow label={label} inspectKey={inspectKey}>
      <div className="flex items-center gap-2">
        <Input
          size="sm"
          type="number"
          min={min}
          max={max}
          step={step}
          value={String(value ?? '')}
          onChange={(e) => {
            const next = Number(e.target.value)
            if (Number.isFinite(next)) onChange(next)
          }}
          aria-label={label}
        />
        {unit ? <span className="text-[11px] app-muted">{unit}</span> : null}
      </div>
    </FormRow>
  )
}

function CheckRow({ label, checked, onChange, inspectKey, hint }) {
  return (
    <FormRow label={label} inspectKey={inspectKey}>
      <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ accentColor: 'var(--accent)' }}
        />
        <span>{checked ? '开启' : '关闭'}</span>
        {hint ? <span className="text-[10px] app-muted">{hint}</span> : null}
      </label>
    </FormRow>
  )
}

function FormRow({ label, children, inspectKey }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <InspectLabel
        target={inspectKey || label}
        className="w-24 shrink-0 cursor-help pt-2 text-xs app-muted"
      >
        {label}
      </InspectLabel>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** 分段按钮：像按钮，而不是几行单选文字 */
function SegmentedChoice({ value, options, onChange, ariaLabel }) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-2"
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={[
              'min-h-10 rounded-xl border px-3 py-2 text-left text-sm transition',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)',
              active
                ? 'border-(--accent) bg-(--accent) font-semibold text-(--accent-foreground) shadow-sm'
                : 'border-(--app-border) bg-(--app-panel) text-foreground hover:border-(--accent) hover:bg-(--accent-soft)',
            ].join(' ')}
          >
            <div className="leading-tight">{opt.label}</div>
            {opt.hint ? (
              <div className={`text-[11px] ${active ? 'opacity-90' : 'app-muted'}`}>{opt.hint}</div>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function ThemeToggle({ theme, toggle }) {
  return (
    <Button
      isIconOnly
      size="sm"
      variant="flat"
      aria-label={theme === 'dark' ? '切换到浅色' : '切换到深色'}
      onPress={toggle}
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
        </svg>
      )}
    </Button>
  )
}

function StudioBody() {
  const store = useSkin()
  const { state, activeScheme, colorFormat } = store
  const { theme, toggle } = useThemeMode()
  const showToast = useToast()
  useUnsavedExitGuard()
  const leftPanel = usePanelWidth('wss-panel-left', 'left', 240)
  const rightPanel = usePanelWidth('wss-panel-right', 'right', 320)
  const [rightTab, setRightTab] = useState('color')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewText, setPreviewText] = useState('')
  const [previewTitle, setPreviewTitle] = useState('写入预览')
  const [confirmAction, setConfirmAction] = useState(null)
  const [saveChoiceOpen, setSaveChoiceOpen] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [uiMode, setUiMode] = useState(() => {
    try { return localStorage.getItem('wss-ui-mode') || 'basic' } catch { return 'basic' }
  })
  const [schemeSearch, setSchemeSearch] = useState('')
  const [presetSearch, setPresetSearch] = useState('')
  const [renderer, setRenderer] = useState('fallback')
  const [previewDpi, setPreviewDpi] = useState(96)
  const [rawYamlDraft, setRawYamlDraft] = useState('')

  useEffect(() => {
    try { localStorage.setItem('wss-ui-mode', uiMode) } catch { /* browser privacy mode */ }
    if (uiMode === 'basic' && rightTab === 'meta') setRightTab('color')
  }, [uiMode, rightTab])

  // Ctrl/Cmd+Z 撤销上一步（输入框内不拦截）
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || e.shiftKey) return
      const el = e.target
      const tag = el && el.tagName ? String(el.tagName).toUpperCase() : ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (el && el.isContentEditable)) return
      e.preventDefault()
      const ok = store.undo()
      if (ok) showToast.info('已撤销上一步', { title: '撤销' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [store, showToast])


  const groupedFields = useMemo(() => {
    const map = { window: [], preedit: [], candidate: [], comment: [], hilited: [], paging: [] }
    for (const f of COLOR_FIELDS) {
      const g = f.group || 'window'
      ;(map[g] ||= []).push(f)
    }
    return map
  }, [])

  const fileLabel = useMemo(() => {
    if (!state.file.loaded) return ''
    const bits = []
    bits.push(state.file.writable ? '可写' : '只读')
    if (state.file.lastSavedAt) bits.push('已保存')
    else if (state.dirty) bits.push('未保存')
    return bits.join(' · ')
  }, [state.file, state.dirty])

  async function onOpenFile() {
    try {
      await store.openWeaselFile()
    } catch (e) {
      if (e?.name !== 'AbortError') showToast.danger(e?.message || String(e), { title: '打开失败' })
    }
  }

  function onPreviewWrite() {
    try {
      const { text } = store.previewSaveText()
      setPreviewText(text)
      setPreviewTitle('保存补丁预览')
      setConfirmAction(() => onSavePatch)
      setPreviewOpen(true)
    } catch (e) {
      showToast.danger(e?.message || String(e), { title: '预览失败' })
    }
  }

  async function onSavePatch() {
    setPreviewOpen(false)
    try {
      const result = await store.saveCustomPatch()
      if (result?.ok) {
        showToast.success(
          result.written ? '已写入 weasel.custom.yaml' : '已导出 weasel.custom.yaml',
          { title: '补丁已保存' },
        )
      } else {
        showToast.info('已取消保存补丁', { title: '未保存' })
      }
    } catch (e) {
      showToast.danger(e?.message || String(e), { title: '保存补丁失败' })
    }
  }

  function onOpenAdvancedSave() {
    setSaveChoiceOpen(true)
  }

  function loadRawYaml() {
    setRawYamlDraft(state.file.loaded && state.file.text ? state.file.text : store.exportAll())
  }

  function applyRawYaml() {
    try {
      store.applyRawYaml(rawYamlDraft)
      showToast.success('已应用原始 YAML 参数', { title: '参数已更新' })
    } catch (e) {
      showToast.danger(e?.message || String(e), { title: 'YAML 无效' })
    }
  }

  async function onOverwriteSource() {
    setSaveChoiceOpen(false)
    try {
      if (!state.file.loaded) {
        showToast.warning('尚未打开源文件。可先「打开配置文件」，或选择「另存为」。', { title: '无法覆盖' })
        return
      }
      await store.overwriteSource()
      showToast.success(`已覆盖 ${state.file.name || '源文件'}`, { title: '保存成功' })
    } catch (e) {
      showToast.danger(e?.message || String(e), { title: '保存失败' })
    }
  }

  async function onSaveAs(kind) {
    setSaveChoiceOpen(false)
    try {
      const result = await store.saveAsFile(kind)
      if (result?.ok) {
        showToast.success(`已保存为 ${result.savedAs || '文件'}`, { title: '另存成功' })
      } else {
        showToast.info('已取消另存', { title: '未保存' })
      }
    } catch (e) {
      showToast.danger(e?.message || String(e), { title: '另存失败' })
    }
  }

  function onDeleteSelected() {
    const ids = state.selectedIds || []
    if (!ids.length) return
    if (!window.confirm(`删除所选 ${ids.length} 个配色？保存时会从 weasel.yaml 移除对应方案。`)) return
    store.removeSchemes(ids)
    store.clearSchemeSelection()
  }

  async function onRemoveFromFile() {
    if (!state.file.loaded) return
    const id = activeScheme?.id
    if (!id) return
    if (!window.confirm(`从 weasel.yaml 删除方案「${id}」？`)) return
    try {
      await store.removeSchemeFromFile(id)
      showToast.success(`已从文件删除「${id}」`, { title: '删除成功' })
    } catch (e) {
      showToast.danger(e?.message || String(e), { title: '删除失败' })
    }
  }

  function onExport(kind) {
    if (kind === 'copy') store.exportWeaselCopy()
    if (kind === 'skin') store.exportSkinYaml()
    if (kind === 'active') {
      navigator.clipboard?.writeText(store.exportActive()).then(() => showToast.success('已复制当前方案 YAML'))
    }
  }

  function copySchemeYaml() {
    if (!activeScheme) return
    navigator.clipboard?.writeText(exportSchemeYaml(activeScheme)).then(() => showToast.success('已复制方案 YAML'))
  }

  function swatchPreview(s) {
    return {
      background: s.colors.back_color ? toCss(s.colors.back_color) : '#333',
      color: s.colors.text_color ? toCss(s.colors.text_color) : '#eee',
    }
  }

  function swatchChip(s) {
    return {
      background: s.colors.hilited_candidate_back_color
        ? toCss(s.colors.hilited_candidate_back_color)
        : 'rgba(37,99,235,0.45)',
    }
  }

  function sourceTag(s) {
    if (s.source === 'file') return '文件'
    if (s.source === 'preset') return '预设'
    return '本地'
  }

  const layoutMode =
    state.style.horizontal && !state.style.vertical_text
      ? 'h'
      : state.style.vertical_text
        ? 'vt'
        : 'v'

  const visibleSchemes = (state.schemes || []).filter((scheme) => {
    const q = schemeSearch.trim().toLowerCase()
    if (!q) return true
    return `${scheme.name} ${scheme.id} ${scheme.author}`.toLowerCase().includes(q)
  })
  const visiblePresets = PRESET_SCHEMES.filter((preset) => {
    const q = presetSearch.trim().toLowerCase()
    if (!q) return true
    return `${preset.name} ${preset.id} ${preset.author}`.toLowerCase().includes(q)
  })

  return (
    <div className="app-shell flex h-full min-h-0 flex-col">
      <header className="app-panel flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <div className="flex items-center gap-2.5">
          <img
            src={appIcon}
            alt="Weasel Skin Studio"
            className="h-7 w-7 rounded-lg object-cover"
            width={28}
            height={28}
          />
          <div>
            <div className="text-sm font-semibold">Weasel Skin Studio</div>
            <div className="text-[11px] app-muted">
              {state.file.loaded ? `${state.file.name} · ${fileLabel}` : '可视化皮肤工坊 · 所见即所得'}
            </div>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <div className="mode-switch" role="group" aria-label="编辑模式">
            <button
              type="button"
              className={uiMode === 'basic' ? 'is-active' : ''}
              onClick={() => setUiMode('basic')}
            >基础</button>
            <button
              type="button"
              className={uiMode === 'advanced' ? 'is-active' : ''}
              onClick={() => setUiMode('advanced')}
            >高级</button>
          </div>
          <ThemeToggle theme={theme} toggle={toggle} />
          <Button
            size="sm"
            variant="flat"
            onPress={onOpenFile}
            title="推荐打开 weasel.custom.yaml 等补丁文件；直接改 weasel.yaml 可能被重新部署覆盖"
          >
            {state.file.loaded ? '更换文件' : '打开配置文件'}
          </Button>
          <Button
            size="sm"
            color="primary"
            onPress={onPreviewWrite}
            title="优先生成 weasel.custom.yaml 的 patch"
          >
            保存补丁
          </Button>
          {uiMode === 'advanced' && (
            <Dropdown>
              <Dropdown.Trigger size="sm" variant="flat">
                高级操作
              </Dropdown.Trigger>
              <Dropdown.Popover>
                <Dropdown.Menu onAction={(key) => key === 'save-options' && onOpenAdvancedSave()} aria-label="高级保存操作">
                  <Dropdown.Item id="save-options">覆盖源文件 / 另存为</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )}
          <Dropdown>
            <Dropdown.Trigger size="sm" variant="flat">
              导出
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu onAction={(key) => onExport(key)} aria-label="导出">
                <Dropdown.Item id="copy">下载 weasel.yaml 副本</Dropdown.Item>
                <Dropdown.Item id="skin">导出皮肤 YAML 片段</Dropdown.Item>
                <Dropdown.Item id="active">复制当前方案 YAML</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className="scroll-y app-panel shrink-0 border-r p-3"
          style={{ width: leftPanel.width }}
        >
          <section className="mb-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold">
                配色
                {(state.selectedIds || []).length > 0 && (
                  <span className="ml-1 app-muted">（已选 {(state.selectedIds || []).length}）</span>
                )}
              </span>
              <div className="flex items-center gap-1">
                {(state.selectedIds || []).length > 0 && (
                  <Button size="sm" variant="light" color="danger" onPress={onDeleteSelected}>
                    删除所选
                  </Button>
                )}
                <Button size="sm" variant="light" color="primary" onPress={() => store.addScheme()}>
                  + 新建
                </Button>
              </div>
            </div>
            <Input
              size="sm"
              value={schemeSearch}
              onChange={(e) => setSchemeSearch(e.target.value)}
              placeholder="搜索方案名称或 id"
              aria-label="搜索配色方案"
              className="mb-2"
            />
            {(state.schemes || []).length === 0 && (
              <div className="rounded-xl border border-dashed border-(--app-border) p-3 text-[11px] app-muted">
                暂无配色方案。点「浏览预设」或打开配置文件。
              </div>
            )}
            <div className="space-y-1.5">
              {visibleSchemes.map((s) => (
                <div
                  key={s.id}
                  className={`cursor-pointer rounded-xl border p-2 transition ${
                    s.id === state.activeSchemeId
                      ? 'border-(--accent) bg-(--accent-soft)'
                      : 'border-(--app-border) hover:border-(--accent)'
                  } ${(state.selectedIds || []).includes(s.id) ? 'ring-1 ring-(--accent)' : ''}`}
                  onClick={() => store.selectScheme(s.id)}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 shrink-0 cursor-pointer"
                      style={{ accentColor: 'var(--accent)' }}
                      checked={(state.selectedIds || []).includes(s.id)}
                      onChange={() => store.toggleSchemeSelect(s.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`选择 ${s.name || s.id}`}
                    />
                    <div className="flex gap-1">
                      <span
                        className="h-5 w-5 rounded border border-(--app-border)"
                        style={{ background: s.colors.back_color ? toCss(s.colors.back_color) : '#333' }}
                      />
                      <span
                        className="h-5 w-5 rounded border border-(--app-border)"
                        style={swatchChip(s)}
                      />
                      <span
                        className="h-5 w-5 rounded border border-(--app-border)"
                        style={{ background: s.colors.text_color ? toCss(s.colors.text_color) : '#ccc' }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium ">{s.name}</div>
                      <div className="truncate text-[10px] app-muted">
                        {sourceTag(s)} · {s.id}
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        aria-label="复制"
                        onPress={() => store.duplicateScheme(s.id)}
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="11" height="11" rx="2" />
                          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                        </svg>
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        aria-label="移除"
                        onPress={() => store.removeScheme(s.id)}
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold">预设</span>
              <Button
                size="sm"
                variant="flat"
                color="primary"
                onPress={() => setShowPresets((v) => !v)}
              >
                {showPresets ? '收起' : '浏览预设'}
              </Button>
            </div>
            {!showPresets && (
              <div className="rounded-xl border border-dashed border-(--app-border) p-3 text-[11px] app-muted">
                需要内置皮肤时点「浏览预设」，或顶栏打开配置文件。
              </div>
            )}
            {showPresets && (
            <div>
              <Input
                size="sm"
                value={presetSearch}
                onChange={(e) => setPresetSearch(e.target.value)}
                placeholder="搜索内置预设"
                aria-label="搜索内置预设"
                className="mb-2"
              />
              <div className="grid grid-cols-2 gap-2">
              {visiblePresets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="rounded-xl border border-(--app-border) p-2 text-left transition hover:border-(--accent)"
                  style={swatchPreview(p)}
                  onClick={() => store.applyPreset(p)}
                >
                  <div className="mb-1 flex items-center gap-1">
                    <span className="rounded px-1 text-[10px]" style={swatchChip(p)}>
                      Aa
                    </span>
                    <span className="text-sm">中</span>
                  </div>
                  <div className="truncate text-[11px] font-medium">{p.name}</div>
                </button>
              ))}
              </div>
            </div>
            )}
          </section>
        </aside>

        <PanelResizer side="left" onPointerDown={leftPanel.onPointerDown} />

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 app-panel border-b px-3 py-2">
            <RadioGroup
              orientation="horizontal"
              value={state.stageMode}
              onChange={store.setStageMode}
              size="sm"
              aria-label="预览背景"
            >
              <Radio value="light">
                      <Radio.Content>浅色</Radio.Content>
                    </Radio>
              <Radio value="dark">
                      <Radio.Content>深色</Radio.Content>
                    </Radio>
              <Radio value="desktop">
                      <Radio.Content>桌面</Radio.Content>
                    </Radio>
            </RadioGroup>
            <span className="text-[11px] app-muted">
              {state.style.inline_preedit ? '编码在输入框' : '编码在候选窗'} ·{' '}
              {layoutMode === 'h' ? '候选横排' : layoutMode === 'vt' ? '竖排文字' : '候选竖排'} ·{' '}
              {state.style.font_point}pt
            </span>
            <span className={`render-status ${renderer === 'native' ? 'is-native' : ''}`}>
              <span className="status-dot" />
              {renderer === 'native' ? '原生渲染' : '近似渲染'} · {previewDpi} DPI
            </span>
            <div className="flex-1" />
            <span className="text-[11px] app-muted">{state.dirty ? '有未保存修改' : '已同步'}</span>
          </div>
          <div className="preview-controls app-panel border-b px-3 py-2">
            <Input
              size="sm"
              label="示例输入"
              labelPlacement="outside-left"
              value={state.sampleText}
              onChange={(e) => store.setSampleText(e.target.value)}
              className="preview-text-input"
              aria-label="示例输入"
            />
            <div className="preview-tip app-muted">点击候选切换高亮；右侧颜色项悬停可定位作用区域</div>
          </div>
          <div className="preview-candidate-strip app-panel border-b px-3 py-2">
            {state.sampleCandidates.map((candidate, index) => (
              <div key={index} className={`preview-candidate-edit ${index === state.selectedCandidate ? 'is-selected' : ''}`}>
                <button type="button" onClick={() => store.setSample(index)} aria-label={`高亮候选 ${index + 1}`}>
                  {candidate.label || index + 1}
                </button>
                <Input
                  size="sm"
                  value={candidate.text}
                  onChange={(e) => store.setSampleCandidate(index, { text: e.target.value })}
                  aria-label={`候选 ${index + 1} 内容`}
                />
                {uiMode === 'advanced' && (
                  <Input
                    size="sm"
                    value={candidate.comment || ''}
                    onChange={(e) => store.setSampleCandidate(index, { comment: e.target.value })}
                    placeholder="注释"
                    aria-label={`候选 ${index + 1} 注释`}
                  />
                )}
              </div>
            ))}
          </div>
          <div
            className={`scroll-y flex flex-1 items-center justify-center p-8 stage-${state.stageMode}`}
          >
            {!activeScheme || (state.schemes || []).length === 0 ? (
              <div className="app-panel max-w-md rounded-2xl border border-(--app-border) p-8 text-center shadow-sm">
                <div className="mb-2 text-base font-semibold">开始设计皮肤</div>
                <p className="mb-5 text-sm app-muted">
                  请选择一个预设，或打开 weasel / weasel.custom.yaml 配置文件。
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button color="primary" onPress={() => setShowPresets(true)}>
                    选择预设
                  </Button>
                  <Button variant="flat" onPress={onOpenFile}>
                    打开文件
                  </Button>
                </div>
              </div>
            ) : (
              <div className="preview-frame rounded-2xl">
                <NativePreview
                  onRendererChange={setRenderer}
                  onDpiChange={setPreviewDpi}
                />
              </div>
            )}
          </div>
        </main>

        <PanelResizer side="right" onPointerDown={rightPanel.onPointerDown} />

        <aside
          className="scroll-y app-panel shrink-0 border-l"
          style={{ width: rightPanel.width }}
        >
          <section className="border-b border-(--app-border) p-3">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${state.file.lastSavedAt ? 'bg-emerald-500' : 'bg-(--app-muted)'}`}
              />
              <span className="min-w-0 flex-1 truncate text-xs">
                {state.file.lastAction || (state.file.loaded ? fileLabel : '未绑定 weasel.yaml')}
              </span>
            </div>
            <div className="mb-2 flex gap-2">
              <Button
                size="sm"
                variant="flat"
                onPress={onPreviewWrite}
              >
                预览写入
              </Button>
              {uiMode === 'advanced' && (
                <Button
                  size="sm"
                  variant="flat"
                  color="danger"
                  isDisabled={!state.file.loaded}
                  onPress={onRemoveFromFile}
                >
                  从文件删除
                </Button>
              )}
            </div>
            <div className="save-hint">
              <strong>推荐保存为补丁</strong>
              <span>写入 <span className="mono">weasel.custom.yaml</span>，重新部署后生效。</span>
            </div>
            {uiMode === 'advanced' && (
              <div className="mt-2 text-[10px] leading-relaxed app-muted">
                高级操作里的“覆盖源文件”会同步左侧方案列表并写入完整 style/layout；原文件中的未知字段和注释会保留。
              </div>
            )}
          </section>

          <div className="p-3">
            <Tabs selectedKey={rightTab} onSelectionChange={setRightTab} aria-label="属性">
              <Tabs.List>
                <Tabs.Tab id="color">配色</Tabs.Tab>
                <Tabs.Tab id="layout">布局</Tabs.Tab>
                <Tabs.Tab id="font">字体</Tabs.Tab>
                {uiMode === 'advanced' && <Tabs.Tab id="meta">方案</Tabs.Tab>}
              </Tabs.List>

              <Tabs.Panel id="color" className="pt-3">
                <div className="mb-3 flex items-center gap-2">
                  <Input
                    size="sm"
                    placeholder="方案名称"
                    value={activeScheme?.name || ''}
                    onChange={(e) => store.setSchemeMeta({ name: e.target.value })}
                    aria-label="方案名称"
                  />
                  <RadioGroup
                    orientation="horizontal"
                    value={colorFormat}
                    onChange={store.setColorFormat}
                    size="sm"
                    aria-label="color_format"
                  >
                    <Radio value="abgr">
                      <Radio.Content>abgr</Radio.Content>
                    </Radio>
                    <Radio value="rgba">
                      <Radio.Content>rgba</Radio.Content>
                    </Radio>
                    <Radio value="argb">
                      <Radio.Content>argb</Radio.Content>
                    </Radio>
                  </RadioGroup>
                </div>
                {groupOrder
                  .filter((g) => uiMode === 'advanced' || (groupedFields[g] || []).some((f) => BASIC_COLOR_KEYS.includes(f.key)))
                  .map((g) => (
                  <details
                    key={g}
                    className="mb-3 rounded-lg border border-(--app-border) px-2"
                    defaultOpen={uiMode === 'advanced' || ['window', 'candidate', 'hilited'].includes(g)}
                  >
                    <summary className="cursor-pointer py-2 text-[11px] font-semibold app-muted">
                      {COLOR_GROUPS[g]}
                    </summary>
                    <div className="pb-1">
                      {(groupedFields[g] || [])
                        .filter((f) => uiMode === 'advanced' || BASIC_COLOR_KEYS.includes(f.key))
                        .map((f) => (
                          <ColorField
                            key={f.key}
                            fieldKey={f.key}
                            label={f.label}
                            optional={f.optional}
                          />
                        ))}
                    </div>
                  </details>
                  ))}
              </Tabs.Panel>

              <Tabs.Panel id="layout" className="pt-3">
                <div className="mb-3 rounded-lg border border-(--app-border) bg-(--app-panel) p-2.5">
                  <div className="mb-1 text-xs font-semibold">显示方式（影响打字手感）</div>
                  <div className="mb-2 text-[10px] leading-relaxed app-muted">
                    这两项决定「编码写在哪、候选怎么排」。改完点右上角保存后，需在小狼毫里重新部署生效。
                  </div>

                  <FormRow label="候选怎么排">
                    <SegmentedChoice
                      ariaLabel="候选排列方向"
                      value={layoutMode}
                      onChange={(v) => {
                        if (v === 'h') {
                          store.setStyle('horizontal', true)
                          store.setStyle('vertical_text', false)
                        } else if (v === 'v') {
                          store.setStyle('horizontal', false)
                          store.setStyle('vertical_text', false)
                        } else {
                          store.setStyle('horizontal', false)
                          store.setStyle('vertical_text', true)
                        }
                      }}
                      options={[
                        { value: 'h', label: '横着排', hint: '一行 · 推荐' },
                        { value: 'v', label: '竖着排', hint: '一列' },
                        { value: 'vt', label: '竖排文字', hint: '字也竖着' },
                      ]}
                    />
                  </FormRow>

                  <FormRow label="编码字母显示在哪">
                    <SegmentedChoice
                      ariaLabel="编码显示位置"
                      value={state.style.inline_preedit ? 'inline' : 'panel'}
                      onChange={(v) => store.setStyle('inline_preedit', v === 'inline')}
                      options={[
                        { value: 'inline', label: '输入框里', hint: '跟光标 · 推荐' },
                        { value: 'panel', label: '候选窗里', hint: '独立预编辑' },
                      ]}
                    />
                    <div className="mt-1 text-[10px] app-muted">
                      选「输入框里」后，拼音字母会出现在你正在打字的地方，不会挤进皮肤窗口。
                    </div>
                  </FormRow>
                </div>

                <RangeRow
                  label="边框宽度"
                  value={state.style.layout.border_width}
                  min={0}
                  max={16}
                  onChange={(v) => store.setLayout('border_width', v)}
                />
                <RangeRow
                  label="窗口圆角" inspectKey="corner_radius"
                  value={state.style.layout.corner_radius}
                  min={0}
                  max={24}
                  onChange={(v) => store.setLayout('corner_radius', v)}
                />
                <RangeRow
                  label="高亮圆角" inspectKey="round_corner"
                  value={state.style.layout.round_corner}
                  min={0}
                  max={24}
                  onChange={(v) => store.setLayout('round_corner', v)}
                />
                {uiMode === 'advanced' ? (
                  <>
                    <NumberRow
                      label="边距 X"
                      inspectKey="margin_x"
                      value={state.style.layout.margin_x}
                      min={-200}
                      max={200}
                      onChange={(v) => store.setLayout('margin_x', v)}
                    />
                    <NumberRow
                      label="边距 Y"
                      inspectKey="margin_y"
                      value={state.style.layout.margin_y}
                      min={-200}
                      max={200}
                      onChange={(v) => store.setLayout('margin_y', v)}
                    />
                  </>
                ) : (
                  <>
                    <RangeRow
                      label="边距 X"
                      inspectKey="margin_x"
                      value={state.style.layout.margin_x}
                      min={0}
                      max={40}
                      onChange={(v) => store.setLayout('margin_x', v)}
                    />
                    <RangeRow
                      label="边距 Y"
                      inspectKey="margin_y"
                      value={state.style.layout.margin_y}
                      min={0}
                      max={40}
                      onChange={(v) => store.setLayout('margin_y', v)}
                    />
                  </>
                )}
                <RangeRow
                  label="候选间距" inspectKey="candidate_spacing"
                  value={state.style.layout.candidate_spacing}
                  min={0}
                  max={48}
                  onChange={(v) => store.setLayout('candidate_spacing', v)}
                />
                <RangeRow
                  label="标签间距" inspectKey="hilite_spacing"
                  value={state.style.layout.hilite_spacing}
                  min={0}
                  max={24}
                  onChange={(v) => store.setLayout('hilite_spacing', v)}
                />
                <RangeRow
                  label="高亮内边距" inspectKey="hilite_padding"
                  value={state.style.layout.hilite_padding}
                  min={0}
                  max={24}
                  onChange={(v) => store.setLayout('hilite_padding', v)}
                />
                <RangeRow
                  label="阴影" inspectKey="shadow_radius"
                  value={state.style.layout.shadow_radius}
                  min={0}
                  max={24}
                  onChange={(v) => store.setLayout('shadow_radius', v)}
                />
                {uiMode === 'advanced' && (
                  <>
                    <RangeRow label="基础间距" inspectKey="spacing" value={state.style.layout.spacing} min={0} max={48} onChange={(v) => store.setLayout('spacing', v)} />
                    <RangeRow label="最小宽度" inspectKey="min_width" value={state.style.layout.min_width} min={0} max={1200} onChange={(v) => store.setLayout('min_width', v)} />
                    <RangeRow label="最大宽度" inspectKey="max_width" value={state.style.layout.max_width} min={0} max={1600} onChange={(v) => store.setLayout('max_width', v)} />
                    <NumberRow label="最小高度" inspectKey="min_height" value={state.style.layout.min_height} min={0} max={1200} onChange={(v) => store.setLayout('min_height', v)} />
                    <NumberRow label="最大高度" inspectKey="max_height" value={state.style.layout.max_height} min={0} max={1600} onChange={(v) => store.setLayout('max_height', v)} />
                    <NumberRow label="高亮内边距 X" inspectKey="hilite_padding_x" value={state.style.layout.hilite_padding_x} min={0} max={64} onChange={(v) => store.setLayout('hilite_padding_x', v)} />
                    <NumberRow label="高亮内边距 Y" inspectKey="hilite_padding_y" value={state.style.layout.hilite_padding_y} min={0} max={64} onChange={(v) => store.setLayout('hilite_padding_y', v)} />
                    <NumberRow label="阴影偏移 X" inspectKey="shadow_offset_x" value={state.style.layout.shadow_offset_x} min={-100} max={100} onChange={(v) => store.setLayout('shadow_offset_x', v)} />
                    <NumberRow label="阴影偏移 Y" inspectKey="shadow_offset_y" value={state.style.layout.shadow_offset_y} min={-100} max={100} onChange={(v) => store.setLayout('shadow_offset_y', v)} />
                    <FormRow label="对齐方式" inspectKey="align_type">
                      <SegmentedChoice
                        ariaLabel="候选对齐方式"
                        value={state.style.layout.align_type || 'center'}
                        onChange={(v) => store.setLayout('align_type', v)}
                        options={[
                          { value: 'top', label: '顶部', hint: '按上边缘对齐' },
                          { value: 'center', label: '居中', hint: '默认' },
                          { value: 'bottom', label: '底部', hint: '按基线底部对齐' },
                        ]}
                      />
                    </FormRow>
                    <NumberRow
                      label="基线"
                      inspectKey="baseline"
                      value={state.style.layout.baseline}
                      min={0}
                      max={200}
                      unit="%"
                      onChange={(v) => store.setLayout('baseline', v)}
                    />
                    <NumberRow
                      label="行距"
                      inspectKey="linespacing"
                      value={state.style.layout.linespacing}
                      min={0}
                      max={300}
                      unit="%"
                      onChange={(v) => store.setLayout('linespacing', v)}
                    />
                    <CheckRow
                      label="竖排从左到右"
                      inspectKey="vertical_text_left_to_right"
                      checked={state.style.vertical_text_left_to_right}
                      onChange={(v) => store.setStyle('vertical_text_left_to_right', v)}
                    />
                    <CheckRow
                      label="竖排文字换列"
                      inspectKey="vertical_text_with_wrap"
                      checked={state.style.vertical_text_with_wrap}
                      onChange={(v) => store.setStyle('vertical_text_with_wrap', v)}
                    />
                    <CheckRow
                      label="竖排自动反向"
                      inspectKey="vertical_auto_reverse"
                      checked={state.style.vertical_auto_reverse}
                      onChange={(v) => store.setStyle('vertical_auto_reverse', v)}
                    />
                  </>
                )}
              </Tabs.Panel>

              <Tabs.Panel id="font" className="pt-3">
                <RangeRow
                  label="全局字号" inspectKey="window"
                  value={state.style.font_point}
                  min={10}
                  max={28}
                  unit="pt"
                  onChange={(v) => store.setStyle('font_point', v)}
                />
                <FormRow label="标签字号" inspectKey="label_font_point">
                  <Input
                    type="number"
                    size="sm"
                    min={8}
                    max={32}
                    value={String(state.style.label_font_point ?? '')}
                    onChange={(e) => store.setStyle('label_font_point', Number(e.target.value) || 8)}
                  />
                </FormRow>
                <FormRow label="注释字号" inspectKey="comment_font_point">
                  <Input
                    type="number"
                    size="sm"
                    min={8}
                    max={32}
                    value={String(state.style.comment_font_point ?? '')}
                    onChange={(e) => store.setStyle('comment_font_point', Number(e.target.value) || 8)}
                  />
                </FormRow>
                <FormRow label="标签格式" inspectKey="label_format">
                  <Input
                    size="sm"
                    className="mono"
                    placeholder="%s."
                    value={state.style.label_format || ''}
                    onChange={(e) => store.setStyle('label_format', e.target.value)}
                  />
                </FormRow>
                <FormRow label="标记字符" inspectKey="hilited_mark_color">
                  <Input
                    size="sm"
                    placeholder="空 = Win11 竖条"
                    value={state.style.mark_text || ''}
                    onChange={(e) => store.setStyle('mark_text', e.target.value)}
                  />
                </FormRow>
                <FormRow label="全局字体" inspectKey="window">
                  <textarea
                    className="yaml-box min-h-[72px]"
                    value={state.style.font_face || ''}
                    onChange={(e) => store.setStyle('font_face', e.target.value)}
                  />
                </FormRow>
                <FormRow label="标签字体" inspectKey="label_color">
                  <Input
                    size="sm"
                    value={state.style.label_font_face || ''}
                    onChange={(e) => store.setStyle('label_font_face', e.target.value)}
                  />
                </FormRow>
                <FormRow label="注释字体" inspectKey="comment_text_color">
                  <Input
                    size="sm"
                    value={state.style.comment_font_face || ''}
                    onChange={(e) => store.setStyle('comment_font_face', e.target.value)}
                  />
                </FormRow>
                {uiMode === 'advanced' && (
                  <>
                    <NumberRow
                      label="候选缩写长度"
                      inspectKey="candidate_abbreviate_length"
                      value={state.style.candidate_abbreviate_length}
                      min={0}
                      max={200}
                      unit="字"
                      onChange={(v) => store.setStyle('candidate_abbreviate_length', v)}
                    />
                    <CheckRow
                      label="滚轮翻页"
                      inspectKey="paging_on_scroll"
                      checked={state.style.paging_on_scroll}
                      onChange={(v) => store.setStyle('paging_on_scroll', v)}
                    />
                    <FormRow label="抗锯齿" inspectKey="antialias_mode">
                      <SegmentedChoice
                        ariaLabel="抗锯齿模式"
                        value={state.style.antialias_mode || 'default'}
                        onChange={(v) => store.setStyle('antialias_mode', v)}
                        options={[
                          { value: 'default', label: '默认' },
                          { value: 'cleartype', label: 'ClearType' },
                          { value: 'grayscale', label: '灰度' },
                          { value: 'aliased', label: '像素' },
                        ]}
                      />
                    </FormRow>
                    <FormRow label="悬停高亮" inspectKey="hover_type">
                      <SegmentedChoice
                        ariaLabel="悬停高亮模式"
                        value={state.style.hover_type || 'none'}
                        onChange={(v) => store.setStyle('hover_type', v)}
                        options={[
                          { value: 'none', label: '关闭' },
                          { value: 'semi_hilite', label: '半高亮' },
                          { value: 'hilite', label: '完整高亮' },
                        ]}
                      />
                    </FormRow>
                  </>
                )}
              </Tabs.Panel>

              <Tabs.Panel id="meta" className="pt-3">
                <FormRow label="名称" inspectKey="window">
                  <Input
                    size="sm"
                    value={activeScheme?.name || ''}
                    onChange={(e) => store.setSchemeMeta({ name: e.target.value })}
                  />
                </FormRow>
                <FormRow label="id" inspectKey="window">
                  <Input
                    size="sm"
                    className="mono"
                    value={activeScheme?.id || ''}
                    onChange={(e) => store.setSchemeMeta({ id: e.target.value })}
                  />
                </FormRow>
                <FormRow label="作者" inspectKey="window">
                  <Input
                    size="sm"
                    value={activeScheme?.author || ''}
                    onChange={(e) => store.setSchemeMeta({ author: e.target.value })}
                  />
                </FormRow>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="flat" onPress={copySchemeYaml}>
                    复制方案 YAML
                  </Button>
                  <Button size="sm" variant="flat" onPress={() => onExport('skin')}>
                    导出皮肤 YAML
                  </Button>
                </div>
                <details className="mt-4 rounded-lg border border-(--app-border) px-2" open={!!rawYamlDraft}>
                  <summary className="cursor-pointer py-2 text-xs font-semibold">原始 YAML 参数</summary>
                  <div className="pb-2">
                    <p className="mb-2 text-[10px] leading-relaxed app-muted">
                      可编辑完整 style/layout 和配色方案。应用前会校验 YAML；未知字段会在当前编辑会话中保留。
                    </p>
                    {!rawYamlDraft && (
                      <Button size="sm" variant="flat" onPress={loadRawYaml}>
                        加载当前 YAML
                      </Button>
                    )}
                    {rawYamlDraft && (
                      <>
                        <textarea
                          className="yaml-box min-h-[240px]"
                          value={rawYamlDraft}
                          onChange={(e) => setRawYamlDraft(e.target.value)}
                          aria-label="原始 YAML 参数"
                        />
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" color="primary" onPress={applyRawYaml}>
                            应用 YAML
                          </Button>
                          <Button size="sm" variant="flat" onPress={loadRawYaml}>
                            重置草稿
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </details>
              </Tabs.Panel>
            </Tabs>
          </div>
        </aside>
      </div>

      {saveChoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="app-panel w-full max-w-md rounded-2xl shadow-xl">
            <div className="border-b border-(--app-border) px-5 py-3 text-sm font-semibold">
              保存
            </div>
            <div className="space-y-2 p-5">
              <p className="text-xs app-muted">
                选择保存方式。按 Rime 定製指南，长期自定义推荐写 weasel.custom.yaml 补丁。
              </p>
              <Button
                className="w-full justify-start"
                variant="flat"
                isDisabled={!state.file.loaded}
                onPress={onOverwriteSource}
              >
                覆盖源文件
                <span className="ml-2 text-[11px] app-muted">
                  {state.file.loaded ? state.file.name : '未打开文件'}
                </span>
              </Button>
              <div className="px-1 text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
                覆盖会直接修改当前文件，可能被小狼毫更新覆盖；建议优先保存补丁。
              </div>
              <Button
                className="w-full justify-start"
                variant="flat"
                onPress={() => onSaveAs('patch')}
              >
                另存为补丁
                <span className="ml-2 text-[11px] app-muted">weasel.custom.yaml</span>
              </Button>
              <Button
                className="w-full justify-start"
                variant="flat"
                onPress={() => onSaveAs('full')}
              >
                另存为完整 YAML
                <span className="ml-2 text-[11px] app-muted">weasel-skin.yaml</span>
              </Button>
            </div>
            <div className="flex justify-end border-t border-(--app-border) px-5 py-3">
              <Button variant="flat" onPress={() => setSaveChoiceOpen(false)}>
                取消
              </Button>
            </div>
          </div>
        </div>
      )}

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6">
          <div className="app-panel w-full max-w-3xl rounded-2xl shadow-xl">
            <div className="border-b border-(--app-border) px-5 py-3 text-sm font-semibold">
              {previewTitle}
            </div>
            <div className="p-5">
              <div className="mb-2 text-[11px] app-muted">
                下列内容将生成 weasel.custom.yaml 补丁；原文件中的注释和未知字段不会被改写。
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-lg border border-(--app-border) p-2">
                  <div className="app-muted">当前方案</div>
                  <div className="mt-1 truncate font-medium">{activeScheme?.name || activeScheme?.id || '—'}</div>
                </div>
                <div className="rounded-lg border border-(--app-border) p-2">
                  <div className="app-muted">颜色字段</div>
                  <div className="mt-1 font-medium">{Object.keys(activeScheme?.colors || {}).length}</div>
                </div>
                <div className="rounded-lg border border-(--app-border) p-2">
                  <div className="app-muted">模式</div>
                  <div className="mt-1 font-medium">{uiMode === 'advanced' ? '完整参数' : '基础参数'}</div>
                </div>
              </div>
              <textarea className="yaml-box" readOnly value={previewText} />
            </div>
            <div className="flex justify-end gap-2 border-t border-(--app-border) px-5 py-3">
              <Button variant="flat" onPress={() => setPreviewOpen(false)}>
                关闭
              </Button>
              <Button color="primary" onPress={() => confirmAction?.()}>
                保存补丁
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SkinStudio() {
  return (
    <SkinProvider>
      <InspectProvider>
        <ToastProvider>
          <StudioBody />
        </ToastProvider>
      </InspectProvider>
    </SkinProvider>
  )
}
