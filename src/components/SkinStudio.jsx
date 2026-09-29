import { useMemo, useState } from 'react'
import {
  Button,
  Dropdown,
  Input,
  Modal,
  NumberField,
  RadioGroup,
  Switch,
  Tabs,
  Tooltip,
} from '@heroui/react'
import { Radio } from '@heroui/react'
import ColorField from './ColorField.jsx'
import LivePreview from './LivePreview.jsx'
import { SkinProvider, useSkin } from '../store/skinStore.jsx'
import { COLOR_FIELDS, COLOR_GROUPS } from '../utils/weaselYaml.js'
import { PRESET_SCHEMES } from '../data/presets.js'
import { toCss } from '../utils/color.js'
import { exportSchemeYaml } from '../utils/weaselYaml.js'

const groupOrder = ['window', 'preedit', 'candidate', 'comment', 'hilited', 'paging']

function RangeRow({ label, value, min, max, unit = 'px', onChange }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <label className="w-24 shrink-0 text-xs text-zinc-600">{label}</label>
      <input
        type="range"
        className="h-1.5 flex-1 accent-blue-600"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="mono w-12 text-right text-[11px] text-zinc-700">
        {value}
        {unit}
      </span>
    </div>
  )
}

function FormRow({ label, children }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <label className="w-24 shrink-0 pt-2 text-xs text-zinc-600">{label}</label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function StudioBody() {
  const store = useSkin()
  const { state, activeScheme, colorFormat } = store
  const [rightTab, setRightTab] = useState('color')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewText, setPreviewText] = useState('')
  const [previewTitle, setPreviewTitle] = useState('写入预览')
  const [confirmAction, setConfirmAction] = useState(null)

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
      if (e?.name !== 'AbortError') alert(e?.message || String(e))
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
      alert(e?.message || String(e))
    }
  }

  async function onSave() {
    try {
      const result = await store.saveToWeaselFile()
      setPreviewOpen(false)
      if (result.needsDownload) {
        alert('当前文件只读，内存副本已更新。可点「导出」下载 weasel.yaml 后手动覆盖。')
      }
    } catch (e) {
      alert(e?.message || String(e))
    }
  }

  async function onRemoveFromFile() {
    if (!state.file.loaded) return
    const id = activeScheme?.id
    if (!id) return
    if (!window.confirm(`从 weasel.yaml 删除方案「${id}」？`)) return
    try {
      await store.removeSchemeFromFile(id)
    } catch (e) {
      alert(e?.message || String(e))
    }
  }

  function onExport(kind) {
    if (kind === 'copy') store.exportWeaselCopy()
    if (kind === 'skin') store.exportSkinYaml()
    if (kind === 'active') {
      navigator.clipboard?.writeText(store.exportActive()).then(() => alert('已复制当前方案 YAML'))
    }
  }

  function copySchemeYaml() {
    if (!activeScheme) return
    navigator.clipboard?.writeText(exportSchemeYaml(activeScheme)).then(() => alert('已复制方案 YAML'))
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
    <div className="flex h-full min-h-0 flex-col bg-zinc-100">
      <header className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400 font-bold text-zinc-950">
            W
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-900">Weasel Skin Studio</div>
            <div className="text-[11px] text-zinc-500">
              {state.file.loaded ? `${state.file.name} · ${fileLabel}` : '可视化皮肤工坊'}
            </div>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Button size="sm" variant="flat" onPress={onOpenFile}>
            {state.file.loaded ? '更换文件' : '打开 weasel.yaml'}
          </Button>
          <Button size="sm" color="primary" onPress={onSave}>
            保存
          </Button>
          <Dropdown>
            <Dropdown.Trigger>
              <Button size="sm" variant="flat">
                导出
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Menu
              onAction={(key) => onExport(key)}
              aria-label="导出"
            >
              <Dropdown.Item id="copy">下载 weasel.yaml 副本</Dropdown.Item>
              <Dropdown.Item id="skin">导出皮肤 YAML 片段</Dropdown.Item>
              <Dropdown.Item id="active">复制当前方案 YAML</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr_320px]">
        <aside className="scroll-y border-r border-zinc-200 bg-white p-3">
          <section className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-700">配色</span>
              <Button size="sm" variant="light" color="primary" onPress={() => store.addScheme()}>
                + 新建
              </Button>
            </div>
            <div className="space-y-1.5">
              {state.schemes.map((s) => (
                <div
                  key={s.id}
                  className={`cursor-pointer rounded-xl border p-2 transition ${
                    s.id === state.activeSchemeId
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                  onClick={() => store.selectScheme(s.id)}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span
                        className="h-5 w-5 rounded border border-zinc-300"
                        style={{ background: s.colors.back_color ? toCss(s.colors.back_color) : '#333' }}
                      />
                      <span
                        className="h-5 w-5 rounded border border-zinc-300"
                        style={swatchChip(s)}
                      />
                      <span
                        className="h-5 w-5 rounded border border-zinc-300"
                        style={{ background: s.colors.text_color ? toCss(s.colors.text_color) : '#ccc' }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-zinc-800">{s.name}</div>
                      <div className="truncate text-[10px] text-zinc-500">
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
              <span className="text-xs font-semibold text-zinc-700">预设</span>
              <span className="text-[10px] text-zinc-500">点击应用</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_SCHEMES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="rounded-xl border border-zinc-200 p-2 text-left transition hover:border-blue-400"
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
          </section>
        </aside>

        <main className="flex min-h-0 flex-col">
          <div className="flex items-center gap-3 border-b border-zinc-200 bg-white px-3 py-2">
            <RadioGroup
              orientation="horizontal"
              value={state.stageMode}
              onChange={store.setStageMode}
              size="sm"
              aria-label="预览背景"
            >
              <Radio value="light">浅色</Radio>
              <Radio value="dark">深色</Radio>
              <Radio value="desktop">桌面</Radio>
            </RadioGroup>
            <span className="text-[11px] text-zinc-500">
              {state.style.inline_preedit ? '行内预编辑' : '独立候选窗'} ·{' '}
              {layoutMode === 'h' ? '横排' : layoutMode === 'vt' ? '竖排文本' : '竖排'} ·{' '}
              {state.style.font_point}pt
            </span>
            <div className="flex-1" />
            <span className="text-[11px] text-zinc-500">{state.dirty ? '有未保存修改' : '已同步'}</span>
          </div>
          <div
            className={`scroll-y flex flex-1 items-center justify-center p-8 ${
              state.stageMode === 'dark'
                ? 'bg-zinc-800'
                : state.stageMode === 'desktop'
                  ? 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900'
                  : 'bg-zinc-200/80'
            }`}
          >
            <div className="preview-frame rounded-2xl">
              <LivePreview />
            </div>
          </div>
        </main>

        <aside className="scroll-y border-l border-zinc-200 bg-white">
          <section className="border-b border-zinc-200 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${state.file.lastSavedAt ? 'bg-emerald-500' : 'bg-zinc-300'}`}
              />
              <span className="min-w-0 flex-1 truncate text-xs text-zinc-700">
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
            <div className="text-[10px] leading-relaxed text-zinc-500">
              保存 = 当前配色 + 字体/布局写入已打开的 weasel.yaml
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
                    <Radio value="abgr">abgr</Radio>
                    <Radio value="rgba">rgba</Radio>
                    <Radio value="argb">argb</Radio>
                  </RadioGroup>
                </div>
                {groupOrder.map((g) => (
                  <div key={g} className="mb-4">
                    <div className="mb-1 text-[11px] font-semibold text-zinc-500">
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
                <FormRow label="排列">
                  <RadioGroup
                    orientation="horizontal"
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
                    size="sm"
                    aria-label="排列"
                  >
                    <Radio value="h">横排</Radio>
                    <Radio value="v">竖排</Radio>
                    <Radio value="vt">竖排文本</Radio>
                  </RadioGroup>
                </FormRow>
                <FormRow label="行内预编辑">
                  <Switch
                    isSelected={!!state.style.inline_preedit}
                    onChange={(v) => store.setStyle('inline_preedit', v)}
                    size="sm"
                  />
                </FormRow>
                <RangeRow
                  label="边框"
                  value={state.style.layout.border_width}
                  min={0}
                  max={16}
                  onChange={(v) => store.setLayout('border_width', v)}
                />
                <RangeRow
                  label="窗口圆角"
                  value={state.style.layout.corner_radius}
                  min={0}
                  max={24}
                  onChange={(v) => store.setLayout('corner_radius', v)}
                />
                <RangeRow
                  label="高亮圆角"
                  value={state.style.layout.round_corner}
                  min={0}
                  max={24}
                  onChange={(v) => store.setLayout('round_corner', v)}
                />
                <RangeRow
                  label="边距 X"
                  value={state.style.layout.margin_x}
                  min={0}
                  max={40}
                  onChange={(v) => store.setLayout('margin_x', v)}
                />
                <RangeRow
                  label="边距 Y"
                  value={state.style.layout.margin_y}
                  min={0}
                  max={40}
                  onChange={(v) => store.setLayout('margin_y', v)}
                />
                <RangeRow
                  label="候选间距"
                  value={state.style.layout.candidate_spacing}
                  min={0}
                  max={48}
                  onChange={(v) => store.setLayout('candidate_spacing', v)}
                />
                <RangeRow
                  label="标签间距"
                  value={state.style.layout.hilite_spacing}
                  min={0}
                  max={24}
                  onChange={(v) => store.setLayout('hilite_spacing', v)}
                />
                <RangeRow
                  label="高亮内边距"
                  value={state.style.layout.hilite_padding}
                  min={0}
                  max={24}
                  onChange={(v) => store.setLayout('hilite_padding', v)}
                />
                <RangeRow
                  label="阴影"
                  value={state.style.layout.shadow_radius}
                  min={0}
                  max={24}
                  onChange={(v) => store.setLayout('shadow_radius', v)}
                />
              </Tabs.Panel>

              <Tabs.Panel id="font" className="pt-3">
                <RangeRow
                  label="全局字号"
                  value={state.style.font_point}
                  min={10}
                  max={28}
                  unit="pt"
                  onChange={(v) => store.setStyle('font_point', v)}
                />
                <FormRow label="标签字号">
                  <NumberField
                    size="sm"
                    minValue={8}
                    maxValue={32}
                    value={state.style.label_font_point}
                    onChange={(v) => store.setStyle('label_font_point', v)}
                  />
                </FormRow>
                <FormRow label="注释字号">
                  <NumberField
                    size="sm"
                    minValue={8}
                    maxValue={32}
                    value={state.style.comment_font_point}
                    onChange={(v) => store.setStyle('comment_font_point', v)}
                  />
                </FormRow>
                <FormRow label="标签格式">
                  <Input
                    size="sm"
                    className="mono"
                    placeholder="%s."
                    value={state.style.label_format || ''}
                    onChange={(e) => store.setStyle('label_format', e.target.value)}
                  />
                </FormRow>
                <FormRow label="标记字符">
                  <Input
                    size="sm"
                    placeholder="空 = Win11 竖条"
                    value={state.style.mark_text || ''}
                    onChange={(e) => store.setStyle('mark_text', e.target.value)}
                  />
                </FormRow>
                <FormRow label="全局字体">
                  <textarea
                    className="yaml-box min-h-[72px]"
                    value={state.style.font_face || ''}
                    onChange={(e) => store.setStyle('font_face', e.target.value)}
                  />
                </FormRow>
                <FormRow label="标签字体">
                  <Input
                    size="sm"
                    value={state.style.label_font_face || ''}
                    onChange={(e) => store.setStyle('label_font_face', e.target.value)}
                  />
                </FormRow>
                <FormRow label="注释字体">
                  <Input
                    size="sm"
                    value={state.style.comment_font_face || ''}
                    onChange={(e) => store.setStyle('comment_font_face', e.target.value)}
                  />
                </FormRow>
              </Tabs.Panel>

              <Tabs.Panel id="meta" className="pt-3">
                <FormRow label="名称">
                  <Input
                    size="sm"
                    value={activeScheme?.name || ''}
                    onChange={(e) => store.setSchemeMeta({ name: e.target.value })}
                  />
                </FormRow>
                <FormRow label="id">
                  <Input
                    size="sm"
                    className="mono"
                    value={activeScheme?.id || ''}
                    onChange={(e) => store.setSchemeMeta({ id: e.target.value })}
                  />
                </FormRow>
                <FormRow label="作者">
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

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <div className="border-b border-zinc-200 px-5 py-3 text-sm font-semibold">
              {previewTitle}
            </div>
            <div className="p-5">
              <div className="mb-2 text-[11px] text-zinc-500">
                下列文本将在「保存」时写入 weasel.yaml（其余内容保留）
              </div>
              <textarea className="yaml-box" readOnly value={previewText} />
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-3">
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
      <StudioBody />
    </SkinProvider>
  )
}
