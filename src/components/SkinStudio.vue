<script setup>
import { computed, ref } from 'vue'
import {
  ElButton,
  ElInput,
  ElSlider,
  ElInputNumber,
  ElRadioGroup,
  ElRadioButton,
  ElMessage,
  ElMessageBox,
  ElDialog,
  ElTabs,
  ElTabPane,
  ElSwitch,
  ElDropdown,
  ElDropdownMenu,
  ElDropdownItem,
} from 'element-plus'
import ColorField from './ColorField.vue'
import LivePreview from './LivePreview.vue'
import { getSkinStore } from '../composables/useSkinStore.js'
import { COLOR_FIELDS, COLOR_GROUPS } from '../utils/weaselYaml.js'
import { PRESET_SCHEMES } from '../data/presets.js'
import { toCss } from '../utils/color.js'

const store = getSkinStore()
const { state } = store

const rightTab = ref('color')
const previewVisible = ref(false)
const previewText = ref('')
const previewTitle = ref('写入预览')

const groupedFields = computed(() => {
  const map = {}
  for (const f of COLOR_FIELDS) {
    if (!map[f.group]) map[f.group] = []
    map[f.group].push(f)
  }
  return map
})
const groupOrder = ['window', 'preedit', 'candidate', 'comment', 'hilited', 'paging']
const scheme = computed(() => store.activeScheme.value)

const fileLabel = computed(() => {
  if (!state.file.loaded) return '未打开文件'
  return state.file.writable ? '可写' : '只读'
})

// ---------- 文件操作（唯一入口语义）----------

async function onOpenFile() {
  try {
    const st = await store.openWeaselFile()
    ElMessage.success(`已打开 ${st.name}（${st.writable ? '可写' : '只读'}）`)
  } catch (err) {
    if (String(err?.message || err).includes('取消')) return
    ElMessage.error(err.message || String(err))
  }
}

/** 保存 = 当前配色 + style 写入已打开的 weasel.yaml */
async function onSave() {
  if (!state.file.loaded) {
    ElMessage.warning('请先打开 weasel.yaml，再保存')
    await onOpenFile()
    if (!state.file.loaded) return
  }
  try {
    const r = await store.saveToWeaselFile()
    if (r.needsDownload) {
      ElMessage.warning(`只读文件，已更新内存。正在下载副本，请手动覆盖 weasel.yaml`)
      store.exportWeaselCopy()
    } else {
      ElMessage.success(`已保存「${r.schemeId}」到 ${state.file.name}`)
    }
  } catch (err) {
    ElMessage.error(err.message || String(err))
  }
}

function onPreviewWrite() {
  if (!state.file.loaded) {
    ElMessage.warning('请先打开 weasel.yaml')
    return
  }
  try {
    const { text, schemeId } = store.previewSaveText()
    previewTitle.value = `写入预览 · ${schemeId}`
    previewText.value = text
    previewVisible.value = true
  } catch (err) {
    ElMessage.error(err.message || String(err))
  }
}

async function onRemoveFromFile() {
  if (!state.file.loaded) {
    ElMessage.warning('请先打开 weasel.yaml')
    return
  }
  try {
    await ElMessageBox.confirm(`从 weasel.yaml 删除「${state.activeSchemeId}」？`, '删除方案', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await store.removeSchemeFromFile(state.activeSchemeId)
    ElMessage.success('已删除')
  } catch (err) {
    if (String(err?.message || err).includes('取消')) return
    ElMessage.error(err.message || String(err))
  }
}

async function onExport(cmd) {
  if (cmd === 'copy') await store.exportWeaselCopy()
  else await store.exportSkinYaml()
  ElMessage.success(cmd === 'copy' ? '已保存 weasel.yaml 副本' : '已导出 weasel-skin.yaml')
}

async function copySchemeYaml() {
  try {
    await navigator.clipboard.writeText(store.exportActive())
    ElMessage.success('已复制当前方案 YAML')
  } catch {
    ElMessage.warning('复制失败')
  }
}

// ---------- 其它编辑 ----------

function applyPreset(p) {
  store.applyPreset(JSON.parse(JSON.stringify(p)))
  ElMessage.success(`已应用「${p.name}」`)
}
function setColorFormat(fmt) {
  store.setColorFormat(fmt)
}
function setStyle(key, val) {
  store.setStyle(key, val)
}
function setLayout(key, val) {
  store.setLayout(key, val)
}
function addScheme() {
  store.addScheme()
}
async function removeScheme(id) {
  try {
    await ElMessageBox.confirm('仅从列表移除（不影响已保存文件）？', '移除配色', {
      type: 'warning',
      confirmButtonText: '移除',
      cancelButtonText: '取消',
    })
    store.removeScheme(id)
  } catch {
    /* cancel */
  }
}
function selectScheme(s) {
  state.activeSchemeId = s.id
  state.style.color_scheme = s.id
}
function swatchPreview(s) {
  const c = s.colors || {}
  return {
    background: c.back_color ? toCss(c.back_color) : '#222',
    color: c.candidate_text_color ? toCss(c.candidate_text_color) : '#fff',
  }
}
function swatchChip(s) {
  const c = s.colors || {}
  return {
    background: c.hilited_candidate_back_color
      ? toCss(c.hilited_candidate_back_color)
      : c.hilited_back_color
        ? toCss(c.hilited_back_color)
        : '#0d9488',
  }
}
function sourceTag(s) {
  return s.source === 'file' ? '文件' : s.source === 'preset' ? '预设' : '本地'
}
async function confirmWrite() {
  await onSave()
  previewVisible.value = false
}
</script>

<template>
  <div class="app-shell">
    <header class="app-topbar">
      <div class="brand">
        <div class="brand-mark">W</div>
        <div class="brand-text">
          <div class="brand-title">Weasel Skin Studio</div>
          <div class="brand-sub">
            {{ state.file.loaded ? `${state.file.name} · ${fileLabel}` : '可视化皮肤工坊' }}
          </div>
        </div>
      </div>

      <div class="topbar-spacer" />

      <!-- 唯一文件操作区：打开 → 保存 → 导出 -->
      <div class="topbar-right">
        <ElButton size="small" @click="onOpenFile">
          {{ state.file.loaded ? '更换文件' : '打开 weasel.yaml' }}
        </ElButton>
        <ElButton size="small" type="primary" class="btn-save" @click="onSave">
          保存
        </ElButton>
        <ElDropdown trigger="click" @command="onExport">
          <ElButton size="small">
            导出
            <svg class="chev" viewBox="0 0 24 24" width="12" height="12">
              <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
          </ElButton>
          <template #dropdown>
            <ElDropdownMenu>
              <ElDropdownItem command="copy">下载 weasel.yaml 副本</ElDropdownItem>
              <ElDropdownItem command="skin">导出皮肤 YAML 片段</ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>
      </div>
    </header>

    <div class="workspace">
      <!-- 左：方案 -->
      <aside class="panel panel-left scroll-y">
        <section class="panel-section">
          <div class="section-title">
            <span>配色</span>
            <ElButton size="small" text type="primary" @click="addScheme">+ 新建</ElButton>
          </div>
          <div class="scheme-list">
            <div
              v-for="s in state.schemes"
              :key="s.id"
              class="scheme-item"
              :class="{ active: s.id === state.activeSchemeId }"
              @click="selectScheme(s)"
            >
              <div class="scheme-swatches">
                <span :style="{ background: s.colors.back_color ? toCss(s.colors.back_color) : '#333' }" />
                <span :style="swatchChip(s)" />
                <span :style="{ background: s.colors.text_color ? toCss(s.colors.text_color) : '#ccc' }" />
              </div>
              <div class="scheme-meta">
                <div class="scheme-name">{{ s.name }}</div>
                <div class="scheme-id">{{ sourceTag(s) }} · {{ s.id }}</div>
              </div>
              <div class="scheme-actions">
                <button class="icon-btn" type="button" title="复制" @click.stop="store.duplicateScheme(s.id)">
                  <svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
                </button>
                <button class="icon-btn danger" type="button" title="移除" @click.stop="removeScheme(s.id)">
                  <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section class="panel-section">
          <div class="section-title">
            <span>预设</span>
            <span class="hint">点击应用</span>
          </div>
          <div class="preset-grid">
            <div v-for="p in PRESET_SCHEMES" :key="p.id" class="preset-card" @click="applyPreset(p)">
              <div class="preset-preview" :style="swatchPreview(p)">
                <span :style="{ ...swatchChip(p), padding: '2px 6px', borderRadius: '3px' }">Aa</span>
                <span>中</span>
              </div>
              <div class="name">{{ p.name }}</div>
            </div>
          </div>
        </section>
      </aside>

      <!-- 中：预览 -->
      <main class="panel-center">
        <div class="stage-toolbar">
          <ElRadioGroup v-model="state.stageMode" size="small">
            <ElRadioButton value="light">浅色</ElRadioButton>
            <ElRadioButton value="dark">深色</ElRadioButton>
            <ElRadioButton value="desktop">桌面</ElRadioButton>
          </ElRadioGroup>
          <span class="small-muted">
            {{ state.style.inline_preedit ? '行内预编辑' : '独立候选窗' }}
            · {{ state.style.horizontal && !state.style.vertical_text ? '横排' : '竖排' }}
            · {{ state.style.font_point }}pt
          </span>
          <div class="topbar-spacer" />
          <span class="small-muted">{{ state.dirty ? '有未保存修改' : '已同步' }}</span>
        </div>
        <div class="stage" :class="state.stageMode">
          <div class="preview-frame">
            <LivePreview />
          </div>
        </div>
      </main>

      <!-- 右：文件状态 + 属性 -->
      <aside class="panel panel-right scroll-y">
        <section class="panel-section action-dock">
          <div class="dock-status">
            <span class="dot" :class="{ on: !!state.file.lastSavedAt }" />
            <span class="dock-status-main">
              {{ state.file.lastAction || (state.file.loaded ? fileLabel : '未绑定 weasel.yaml') }}
            </span>
          </div>
          <div class="dock-row">
            <ElButton size="small" @click="onPreviewWrite" :disabled="!state.file.loaded">
              预览写入
            </ElButton>
            <ElButton size="small" @click="onRemoveFromFile" :disabled="!state.file.loaded">
              从文件删除
            </ElButton>
          </div>
          <div class="dock-hint">
            保存 = 当前配色 + 字体/布局写入已打开的 weasel.yaml
          </div>
        </section>

        <div class="panel-body">
          <ElTabs v-model="rightTab" class="prop-tabs">
            <ElTabPane label="配色" name="color">
              <div class="meta-row">
                <ElInput
                  :model-value="scheme?.name"
                  size="small"
                  placeholder="方案名称"
                  @update:model-value="(v) => store.setSchemeMeta({ name: v })"
                />
                <ElRadioGroup :model-value="scheme?.color_format" size="small" @update:model-value="setColorFormat">
                  <ElRadioButton value="abgr">abgr</ElRadioButton>
                  <ElRadioButton value="rgba">rgba</ElRadioButton>
                  <ElRadioButton value="argb">argb</ElRadioButton>
                </ElRadioGroup>
              </div>
              <div v-for="g in groupOrder" :key="g" class="color-group-block">
                <div class="group-label">{{ COLOR_GROUPS[g] }}</div>
                <ColorField
                  v-for="f in groupedFields[g]"
                  :key="f.key"
                  :field-key="f.key"
                  :label="f.label"
                  :optional="f.optional"
                />
              </div>
            </ElTabPane>

            <ElTabPane label="布局" name="layout">
              <div class="form-grid">
                <div class="form-row">
                  <label>排列</label>
                  <ElRadioGroup
                    :model-value="
                      state.style.horizontal && !state.style.vertical_text
                        ? 'h'
                        : state.style.vertical_text
                          ? 'vt'
                          : 'v'
                    "
                    size="small"
                    @update:model-value="
                      (v) => {
                        if (v === 'h') {
                          setStyle('horizontal', true)
                          setStyle('vertical_text', false)
                        } else if (v === 'v') {
                          setStyle('horizontal', false)
                          setStyle('vertical_text', false)
                        } else {
                          setStyle('horizontal', false)
                          setStyle('vertical_text', true)
                        }
                      }
                    "
                  >
                    <ElRadioButton value="h">横排</ElRadioButton>
                    <ElRadioButton value="v">竖排</ElRadioButton>
                    <ElRadioButton value="vt">竖排文本</ElRadioButton>
                  </ElRadioGroup>
                </div>
                <div class="form-row">
                  <label>行内预编辑</label>
                  <ElSwitch
                    :model-value="state.style.inline_preedit"
                    @update:model-value="(v) => setStyle('inline_preedit', v)"
                  />
                </div>
                <div class="form-row">
                  <label>边框</label>
                  <div class="slider-with-val">
                    <ElSlider
                      :model-value="state.style.layout.border_width"
                      :min="0"
                      :max="16"
                      size="small"
                      @update:model-value="(v) => setLayout('border_width', v)"
                    />
                    <span class="val mono">{{ state.style.layout.border_width }}px</span>
                  </div>
                </div>
                <div class="form-row">
                  <label>窗口圆角</label>
                  <div class="slider-with-val">
                    <ElSlider
                      :model-value="state.style.layout.corner_radius"
                      :min="0"
                      :max="24"
                      size="small"
                      @update:model-value="(v) => setLayout('corner_radius', v)"
                    />
                    <span class="val mono">{{ state.style.layout.corner_radius }}px</span>
                  </div>
                </div>
                <div class="form-row">
                  <label>高亮圆角</label>
                  <div class="slider-with-val">
                    <ElSlider
                      :model-value="state.style.layout.round_corner"
                      :min="0"
                      :max="24"
                      size="small"
                      @update:model-value="(v) => setLayout('round_corner', v)"
                    />
                    <span class="val mono">{{ state.style.layout.round_corner }}px</span>
                  </div>
                </div>
                <div class="form-row">
                  <label>边距 X/Y</label>
                  <div class="inline-fields">
                    <ElInputNumber
                      :model-value="state.style.layout.margin_x"
                      :min="0"
                      :max="40"
                      size="small"
                      controls-position="right"
                      @update:model-value="(v) => setLayout('margin_x', v)"
                    />
                    <ElInputNumber
                      :model-value="state.style.layout.margin_y"
                      :min="0"
                      :max="40"
                      size="small"
                      controls-position="right"
                      @update:model-value="(v) => setLayout('margin_y', v)"
                    />
                  </div>
                </div>
                <div class="form-row">
                  <label>候选间距</label>
                  <div class="slider-with-val">
                    <ElSlider
                      :model-value="state.style.layout.candidate_spacing"
                      :min="0"
                      :max="48"
                      size="small"
                      @update:model-value="(v) => setLayout('candidate_spacing', v)"
                    />
                    <span class="val mono">{{ state.style.layout.candidate_spacing }}px</span>
                  </div>
                </div>
                <div class="form-row">
                  <label>标签间距</label>
                  <div class="slider-with-val">
                    <ElSlider
                      :model-value="state.style.layout.hilite_spacing"
                      :min="0"
                      :max="24"
                      size="small"
                      @update:model-value="(v) => setLayout('hilite_spacing', v)"
                    />
                    <span class="val mono">{{ state.style.layout.hilite_spacing }}px</span>
                  </div>
                </div>
                <div class="form-row">
                  <label>高亮内边距</label>
                  <div class="slider-with-val">
                    <ElSlider
                      :model-value="state.style.layout.hilite_padding"
                      :min="0"
                      :max="24"
                      size="small"
                      @update:model-value="(v) => setLayout('hilite_padding', v)"
                    />
                    <span class="val mono">{{ state.style.layout.hilite_padding }}px</span>
                  </div>
                </div>
                <div class="form-row">
                  <label>阴影</label>
                  <div class="slider-with-val">
                    <ElSlider
                      :model-value="state.style.layout.shadow_radius"
                      :min="0"
                      :max="24"
                      size="small"
                      @update:model-value="(v) => setLayout('shadow_radius', v)"
                    />
                    <span class="val mono">{{ state.style.layout.shadow_radius }}px</span>
                  </div>
                </div>
              </div>
            </ElTabPane>

            <ElTabPane label="字体" name="font">
              <div class="form-grid">
                <div class="form-row">
                  <label>全局字号</label>
                  <div class="slider-with-val">
                    <ElSlider
                      :model-value="state.style.font_point"
                      :min="10"
                      :max="28"
                      size="small"
                      @update:model-value="(v) => setStyle('font_point', v)"
                    />
                    <span class="val mono">{{ state.style.font_point }}pt</span>
                  </div>
                </div>
                <div class="form-row">
                  <label>标签字号</label>
                  <ElInputNumber
                    :model-value="state.style.label_font_point"
                    :min="8"
                    :max="32"
                    size="small"
                    controls-position="right"
                    @update:model-value="(v) => setStyle('label_font_point', v)"
                  />
                </div>
                <div class="form-row">
                  <label>注释字号</label>
                  <ElInputNumber
                    :model-value="state.style.comment_font_point"
                    :min="8"
                    :max="32"
                    size="small"
                    controls-position="right"
                    @update:model-value="(v) => setStyle('comment_font_point', v)"
                  />
                </div>
                <div class="form-row">
                  <label>标签格式</label>
                  <ElInput
                    :model-value="state.style.label_format"
                    size="small"
                    class="mono"
                    placeholder="%s."
                    @update:model-value="(v) => setStyle('label_format', v)"
                  />
                </div>
                <div class="form-row">
                  <label>标记字符</label>
                  <ElInput
                    :model-value="state.style.mark_text"
                    size="small"
                    placeholder="空 = Win11 竖条"
                    @update:model-value="(v) => setStyle('mark_text', v)"
                  />
                </div>
                <div class="form-row">
                  <label>全局字体</label>
                  <ElInput
                    :model-value="state.style.font_face"
                    type="textarea"
                    :rows="2"
                    size="small"
                    @update:model-value="(v) => setStyle('font_face', v)"
                  />
                </div>
                <div class="form-row">
                  <label>标签字体</label>
                  <ElInput
                    :model-value="state.style.label_font_face"
                    size="small"
                    @update:model-value="(v) => setStyle('label_font_face', v)"
                  />
                </div>
                <div class="form-row">
                  <label>注释字体</label>
                  <ElInput
                    :model-value="state.style.comment_font_face"
                    size="small"
                    @update:model-value="(v) => setStyle('comment_font_face', v)"
                  />
                </div>
              </div>
            </ElTabPane>

            <ElTabPane label="方案" name="meta">
              <div class="form-grid">
                <div class="form-row">
                  <label>名称</label>
                  <ElInput
                    :model-value="scheme?.name"
                    size="small"
                    @update:model-value="(v) => store.setSchemeMeta({ name: v })"
                  />
                </div>
                <div class="form-row">
                  <label>id</label>
                  <ElInput
                    :model-value="scheme?.id"
                    size="small"
                    class="mono"
                    @update:model-value="(v) => store.setSchemeMeta({ id: v })"
                  />
                </div>
                <div class="form-row">
                  <label>作者</label>
                  <ElInput
                    :model-value="scheme?.author"
                    size="small"
                    @update:model-value="(v) => store.setSchemeMeta({ author: v })"
                  />
                </div>
              </div>
              <div class="dock-row" style="margin-top: 12px">
                <ElButton size="small" @click="copySchemeYaml">复制方案 YAML</ElButton>
                <ElButton size="small" @click="onExport('skin')">导出皮肤 YAML</ElButton>
              </div>
            </ElTabPane>
          </ElTabs>
        </div>
      </aside>
    </div>

    <ElDialog v-model="previewVisible" :title="previewTitle" width="720px" top="6vh">
      <div class="small-muted" style="margin-bottom: 8px">
        下列文本将在「保存」时写入 weasel.yaml（其余内容保留）
      </div>
      <textarea class="yaml-box" readonly :value="previewText" />
      <template #footer>
        <ElButton @click="previewVisible = false">关闭</ElButton>
        <ElButton type="primary" @click="confirmWrite">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.meta-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.meta-row .el-input {
  flex: 1;
  min-width: 120px;
}
.panel-body {
  padding: 0 14px 20px;
}
.prop-tabs :deep(.el-tabs__header) {
  margin: 0 0 12px;
}
.prop-tabs :deep(.el-tabs__item) {
  padding: 0 14px;
  height: 36px;
}
.dock-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--inset);
  border: 1px solid var(--border);
  font-size: 11px;
  color: var(--ink-muted);
}
.dock-status-main {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dock-hint {
  margin-top: 8px;
  font-size: 10.5px;
  color: var(--ink-faint);
  line-height: 1.45;
}
.chev {
  margin-left: 2px;
  opacity: 0.7;
}
</style>
