import { useMemo, useState } from 'react'
import {
  Button,
  Toast,
  toast,
  Dropdown,
  Input,
  Modal,
  RadioGroup,
  Switch,
  Tabs,
  Tooltip,
} from '@heroui/react'
import { Radio } from '@heroui/react'
import ColorField from './ColorField.jsx'
import LivePreview from './LivePreview.jsx'
import { SkinProvider, useSkin } from '../store/skinStore.jsx'
import { useThemeMode } from '../hooks/useThemeMode.js'
import { InspectProvider, InspectLabel, useInspect } from '../hooks/useInspect.jsx'
import { usePanelWidth, PanelResizer } from '../hooks/usePanelWidth.jsx'
import { COLOR_FIELDS, COLOR_GROUPS } from '../utils/weaselYaml.js'
import { PRESET_SCHEMES } from '../data/presets.js'
import { toCss } from '../utils/color.js'
import { exportSchemeYaml } from '../utils/weaselYaml.js'

const groupOrder = ['window', 'preedit', 'candidate', 'comment', 'hilited', 'paging']

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
  const leftPanel = usePanelWidth('wss-panel-left', 'left', 240)
  const rightPanel = usePanelWidth('wss-panel-right', 'right', 320)
  const [rightTab, setRightTab] = useState('color')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewText, setPreviewText] = useState('')
  const [previewTitle, setPreviewTitle] = useState('写入预览')
  const [confirmAction, setConfirmAction] = useState(null)
  const [saveChoiceOpen, setSaveChoiceOpen] = useState(false)
  const [showPresets, setShowPresets] = useState(false)

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
      if (e?.name !== 'AbortError') toast.danger(e?.message || String(e), { title: '打开失败' })
    }
  }

  function onPreviewWrite() {
    try {
      const { text } = store.previewSaveText()
      setPreviewText(text)
      setPreviewTitle('写入预览')
      setConfirmAction(() => onSave)
      setPreviewOpen(true)
    } catch (e) {
      toast.danger(e?.message || String(e), { title: '预览失败' })
    }
  }

  function onSave() {
    // 弹出：覆盖源文件 / 另存为
    setSaveChoiceOpen(true)
  }

  async function onOverwriteSource() {
    setSaveChoiceOpen(false)
    try {
      if (!state.file.loaded) {
        toast.warning('尚未打开源文件。可先「打开配置文件」，或选择「另存为」。', { title: '无法覆盖' })
        return
      }
      await store.overwriteSource()
      toast.success(`已覆盖 ${state.file.name || '源文件'}`, { title: '保存成功' })
    } catch (e) {
      toast.danger(e?.message || String(e), { title: '保存失败' })
    }
  }

  async function onSaveAs(kind) {
    setSaveChoiceOpen(false)
    try {
      const result = await store.saveAsFile(kind)
      if (result?.ok) {
        toast.success(`已保存为 ${result.savedAs || '文件'}`, { title: '另存成功' })
      } else {
        toast.info('已取消另存', { title: '未保存' })
      }
    } catch (e) {
      toast.danger(e?.message || String(e), { title: '另存失败' })
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
      toast.success(`已从文件删除「${id}」`, { title: '删除成功' })
    } catch (e) {
      toast.danger(e?.message || String(e), { title: '删除失败' })
    }
  }

  function onExport(kind) {
    if (kind === 'copy') store.exportWeaselCopy()
    if (kind === 'skin') store.exportSkinYaml()
    if (kind === 'active') {
      navigator.clipboard?.writeText(store.exportActive()).then(() => toast.success('已复制当前方案 YAML'))
    }
  }

  function copySchemeYaml() {
    if (!activeScheme) return
    navigator.clipboard?.writeText(exportSchemeYaml(activeScheme)).then(() => toast.success('已复制方案 YAML'))
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

  return (
    <div className="app-shell flex h-full min-h-0 flex-col">
      <header className="app-panel flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <div className="flex items-center gap-2.5">
          <div className="brand-mark flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold">
            W
          </div>
          <div>
            <div className="text-sm font-semibold">Weasel Skin Studio</div>
            <div className="text-[11px] app-muted">
              {state.file.loaded ? `${state.file.name} · ${fileLabel}` : '可视化皮肤工坊'}
            </div>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
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
            onPress={onSave}
            title="生成 weasel.custom.yaml 的 patch 并写入/另存，不直接改 weasel.yaml"
          >
            保存
          </Button>
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
            {(state.schemes || []).length === 0 && (
              <div className="rounded-xl border border-dashed border-(--app-border) p-3 text-[11px] app-muted">
                暂无配色方案。点「浏览预设」或打开配置文件。
              </div>
            )}
            <div className="space-y-1.5">
              {(state.schemes || []).map((s) => (
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
            <div className="grid grid-cols-2 gap-2">
              {PRESET_SCHEMES.map((p) => (
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
            <div className="flex-1" />
            <span className="text-[11px] app-muted">{state.dirty ? '有未保存修改' : '已同步'}</span>
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
                <LivePreview />
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
                isDisabled={!state.file.loaded}
                onPress={onPreviewWrite}
              >
                预览写入
              </Button>
              <Button
                size="sm"
                variant="flat"
                color="danger"
                isDisabled={!state.file.loaded}
                onPress={onRemoveFromFile}
              >
                从文件删除
              </Button>
            </div>
            <div className="rounded-lg border border-(--accent) bg-(--accent-soft) p-2 text-[11px] leading-relaxed">
              <div className="mb-1 font-semibold">提示：用补丁配置，不要直接改 weasel.yaml</div>
              <div className="app-muted">
                按 Rime 定製指南：自定义写入 <span className="mono font-semibold text-[color:var(--accent-soft-foreground)]">weasel.custom.yaml</span> 的 <span className="mono">patch:</span>
                （或部署时的 patch），不要直接改 <span className="mono">weasel.yaml</span>——重新部署可能被覆盖。
                「保存补丁」写 weasel.custom.yaml 的 patch，不直接改 weasel.yaml。写完请重新部署。部署后设定页打不开，多半是 YAML 已损坏。
              </div>
            </div>
            <div className="mt-2 text-[10px] leading-relaxed app-muted">
              保存 = 当前配色 + 显示方式 + 字体/布局 写入已打开文件；文件里多余方案会删掉，只保留左侧列表。
            </div>
          </section>

          <div className="p-3">
            <Tabs selectedKey={rightTab} onSelectionChange={setRightTab} aria-label="属性">
              <Tabs.List>
                <Tabs.Tab id="color">配色</Tabs.Tab>
                <Tabs.Tab id="layout">布局</Tabs.Tab>
                <Tabs.Tab id="font">字体</Tabs.Tab>
                <Tabs.Tab id="meta">方案</Tabs.Tab>
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
                {groupOrder.map((g) => (
                  <div key={g} className="mb-4">
                    <div className="mb-1 text-[11px] font-semibold app-muted">
                      {COLOR_GROUPS[g]}
                    </div>
                    {(groupedFields[g] || []).map((f) => (
                      <ColorField
                        key={f.key}
                        fieldKey={f.key}
                        label={f.label}
                        optional={f.optional}
                      />
                    ))}
                  </div>
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
                <RangeRow
                  label="边距 X" inspectKey="margin_x"
                  value={state.style.layout.margin_x}
                  min={0}
                  max={40}
                  onChange={(v) => store.setLayout('margin_x', v)}
                />
                <RangeRow
                  label="边距 Y" inspectKey="margin_y"
                  value={state.style.layout.margin_y}
                  min={0}
                  max={40}
                  onChange={(v) => store.setLayout('margin_y', v)}
                />
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
                下列文本将在「保存」时写入 weasel.yaml（其余内容保留）
              </div>
              <textarea className="yaml-box" readOnly value={previewText} />
            </div>
            <div className="flex justify-end gap-2 border-t border-(--app-border) px-5 py-3">
              <Button variant="flat" onPress={() => setPreviewOpen(false)}>
                关闭
              </Button>
              <Button color="primary" onPress={() => confirmAction?.()}>
                保存
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
        <Toast.Provider placement="bottom-end" maxVisibleToasts={4}>
          <StudioBody />
        </Toast.Provider>
      </InspectProvider>
    </SkinProvider>
  )
}
