import { useMemo } from 'react'
import { Input, Tooltip, Slider, Button } from '@heroui/react'
import { toCss, parseHexToRgba, rgbaToHex } from '../utils/color.js'
import { useSkin } from '../store/skinStore.jsx'

export default function ColorField({ fieldKey, label, optional = false }) {
  const { getColor, setColor, weaselColor } = useSkin()
  const value = getColor(fieldKey)

  const hex = useMemo(() => (value ? rgbaToHex(value, true) : '#00000000'), [value])
  const css = value ? toCss(value) : 'transparent'
  const weaselVal = weaselColor(fieldKey)

  function onHexChange(v) {
    setColor(fieldKey, parseHexToRgba(v))
  }

  function onColorInput(e) {
    const prev = value
    setColor(fieldKey, {
      ...parseHexToRgba(e.target.value),
      a: prev?.a ?? 255,
    })
  }

  function onAlpha(v) {
    const prev = value
    if (!prev) return
    const next = Array.isArray(v) ? v[0] : v
    setColor(fieldKey, { ...prev, a: Math.round(next) })
  }

  return (
    <div className="flex items-center gap-2 border-b border-zinc-200/80 py-2 last:border-b-0">
        <div className="w-28 shrink-0">
          <div className="text-xs font-medium">{label}</div>
          <div className="mono text-[10px] app-muted">{weaselVal}</div>
        </div>

        <div className="flex flex-1 items-center gap-2">
          <label
            className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-(--app-border)"
          style={{
            background: value
              ? css
              : 'repeating-conic-gradient(#666 0% 25%, #444 0% 50%) 50% / 10px 10px',
          }}
          title={`${label} 色块`}
        >
          <input
            type="color"
            className="absolute inset-0 cursor-pointer opacity-0"
            value={hex.slice(0, 7)}
            onChange={onColorInput}
          />
        </label>

        <Input
          className="w-28"
          size="sm"
          value={hex}
          onChange={(e) => onHexChange(e.target.value)}
          aria-label={`${label} 十六进制`}
        />

        {value && (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="mono w-8 text-[11px] app-muted">{value.a ?? 255}</span>
            <Tooltip content="透明度 0–255">
              <Slider
                aria-label={`${label} 透明度`}
                className="min-w-0 flex-1"
                minValue={0}
                maxValue={255}
                step={1}
                value={[value.a ?? 255]}
                onChange={(v) => onAlpha(v)}
                size="sm"
              >
                <Slider.Track>
                  <Slider.Fill />
                  <Slider.Thumb />
                </Slider.Track>
              </Slider>
            </Tooltip>
          </div>
        )}

        {optional && value && (
          <Button
            isIconOnly
            size="sm"
            variant="light"
            color="danger"
            aria-label="清除该颜色"
            onPress={() => setColor(fieldKey, null)}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Button>
        )}
      </div>
    </div>
  )
}
