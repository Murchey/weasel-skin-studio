<script setup>
import { computed } from 'vue'
import { ElInput, ElSlider, ElTooltip } from 'element-plus'
import { toCss, parseHexToRgba, rgbaToHex } from '../utils/color.js'
import { getSkinStore } from '../composables/useSkinStore.js'

const props = defineProps({
  fieldKey: { type: String, required: true },
  label: { type: String, required: true },
  optional: { type: Boolean, default: false },
})

const store = getSkinStore()

const value = computed(() => store.getColor(props.fieldKey))

const hex = computed({
  get() {
    const v = value.value
    return v ? rgbaToHex(v, true) : '#00000000'
  },
  set(val) {
    const rgba = parseHexToRgba(val)
    store.setColor(props.fieldKey, rgba)
  },
})

const css = computed(() => (value.value ? toCss(value.value) : 'transparent'))
const weaselVal = computed(() => store.weaselColor(props.fieldKey))

function onColorInput(e) {
  const hexVal = e.target.value
  const prev = value.value
  store.setColor(props.fieldKey, {
    ...parseHexToRgba(hexVal),
    a: prev?.a ?? 255,
  })
}

function onAlpha(v) {
  const prev = value.value
  if (!prev) return
  store.setColor(props.fieldKey, { ...prev, a: Math.round(v) })
}

function clearField() {
  store.setColor(props.fieldKey, null)
}

function onHexBlur() {
  // ensure valid
  hex.value = hex.value
}
</script>

<template>
  <div class="color-row">
    <div class="color-label">
      <span class="name">{{ label }}</span>
      <span class="key">{{ weaselVal }}</span>
    </div>
    <div class="color-controls">
      <button
        class="color-swatch-btn"
        :style="{
          background: value ? css : 'repeating-conic-gradient(#666 0% 25%, #444 0% 50%) 50% / 10px 10px',
        }"
        type="button"
        :aria-label="label + ' 色块'"
      >
        <input type="color" :value="hex.slice(0, 7)" @input="onColorInput" />
      </button>
      <ElInput
        v-model="hex"
        class="color-hex"
        size="small"
        @blur="onHexBlur"
      />
      <ElTooltip content="透明度 0–255" placement="top">
        <div class="alpha-wrap" v-if="value">
          <span class="alpha-val mono">{{ value.a ?? 255 }}</span>
          <ElSlider
            :model-value="value.a ?? 255"
            :min="0"
            :max="255"
            :show-tooltip="false"
            size="small"
            @update:model-value="onAlpha"
          />
        </div>
      </ElTooltip>
      <button
        v-if="optional && value"
        class="icon-btn danger"
        type="button"
        title="清除"
        aria-label="清除该颜色"
        @click="clearField"
      >
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
  </div>
</template>
