import { useEffect, useMemo, useRef, useState } from 'react'
import { useSkin } from '../store/skinStore.jsx'
import LivePreview from './LivePreview.jsx'
import { renderNativePreview, previewDpi } from '../utils/previewApi.js'

function regionClass(id) {
  if (id.startsWith('candidate:')) return 'preview-region preview-region-candidate'
  if (id === 'highlight') return 'preview-region preview-region-highlight'
  return 'preview-region'
}

/** Native DirectWrite preview with a CSS fallback for browser development. */
export default function NativePreview({ onRendererChange, onDpiChange }) {
  const { state, activeScheme, setSample } = useSkin()
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const generation = useRef(0)
  const dpi = previewDpi()

  const request = useMemo(() => ({
    style: state.style,
    scheme: {
      colorFormat: activeScheme?.color_format || 'rgba',
      colors: activeScheme?.colors || {},
    },
    candidates: state.sampleCandidates,
    selectedCandidate: state.selectedCandidate,
    preedit: {
      text: state.sampleText || 'zhongwen',
      highlightStart: 0,
      highlightEnd: state.sampleText?.length || 0,
    },
    dpi,
    stage: state.stageMode,
  }), [state.style, state.sampleCandidates, state.selectedCandidate, state.sampleText, state.stageMode, activeScheme, dpi])

  useEffect(() => {
    onDpiChange?.(dpi)
    let cancelled = false
    const current = ++generation.current
    const timer = window.setTimeout(async () => {
      setBusy(true)
      try {
        const next = await renderNativePreview(request)
        if (cancelled || current !== generation.current) return
        setResult(next)
        onRendererChange?.(next?.renderer === 'native' ? 'native' : 'fallback')
      } catch {
        if (cancelled || current !== generation.current) return
        setResult(null)
        onRendererChange?.('fallback')
      } finally {
        if (!cancelled && current === generation.current) setBusy(false)
      }
    }, 24)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [request, dpi, onRendererChange, onDpiChange])

  if (!result?.pngBase64 || result.renderer !== 'native') {
    return (
      <div className="relative">
        <LivePreview />
        <div className="preview-fallback-badge">
          {busy ? '正在同步原生预览…' : '浏览器近似预览'}
        </div>
      </div>
    )
  }

  const src = result.pngBase64.startsWith('data:')
    ? result.pngBase64
    : `data:image/png;base64,${result.pngBase64}`
  const width = Number(result.width) || 1
  const height = Number(result.height) || 1

  return (
    <div className="relative inline-block max-w-full" style={{ width, aspectRatio: `${width} / ${height}` }}>
      <img
        src={src}
        alt="小狼毫候选窗原生预览"
        className="block h-auto max-w-full select-none"
        draggable="false"
      />
      <div className="pointer-events-none absolute inset-0">
        {(result.regions || []).map((region) => (
          <button
            key={`${region.id}:${region.x}:${region.y}`}
            type="button"
            aria-label={region.id}
            className={regionClass(region.id)}
            style={{
              left: `${(region.x / width) * 100}%`,
              top: `${(region.y / height) * 100}%`,
              width: `${(region.width / width) * 100}%`,
              height: `${(region.height / height) * 100}%`,
              pointerEvents: region.id.startsWith('candidate:') ? 'auto' : 'none',
            }}
            onClick={() => {
              const index = Number(region.id.split(':')[1])
              if (Number.isInteger(index)) setSample(index)
            }}
          />
        ))}
      </div>
      <div className="preview-native-badge">
        {(result.warnings || []).length ? 'Windows 原生兼容渲染' : 'Windows 原生 · DirectWrite'}
      </div>
    </div>
  )
}
