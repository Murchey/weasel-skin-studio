import { useCallback, useEffect, useRef, useState } from 'react'

const MIN = 180
const MAX = 480

function clamp(n, min = MIN, max = MAX) {
  return Math.min(max, Math.max(min, n))
}

function readStored(key, fallback) {
  try {
    const v = Number(localStorage.getItem(key))
    return Number.isFinite(v) && v > 0 ? clamp(v) : fallback
  } catch {
    return fallback
  }
}

/**
 * Horizontal panel width with drag resize.
 * side: 'left' grows to the right; 'right' grows to the left.
 */
export function usePanelWidth(key, side, initial = 240) {
  const [width, setWidth] = useState(() => readStored(key, initial))
  const dragging = useRef(false)

  useEffect(() => {
    try {
      localStorage.setItem(key, String(width))
    } catch {
      /* ignore */
    }
  }, [key, width])

  const onPointerDown = useCallback(
    (e) => {
      e.preventDefault()
      dragging.current = true
      const startX = e.clientX
      const startW = width

      const move = (ev) => {
        if (!dragging.current) return
        const dx = ev.clientX - startX
        const next = side === 'left' ? startW + dx : startW - dx
        setWidth(clamp(next))
      }
      const up = () => {
        dragging.current = false
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [side, width],
  )

  return { width, setWidth, onPointerDown }
}

export function PanelResizer({ onPointerDown, side = 'left' }) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={side === 'left' ? '调整左侧面板宽度' : '调整右侧面板宽度'}
      onPointerDown={onPointerDown}
      className="group relative w-1.5 shrink-0 cursor-col-resize bg-transparent"
      title="拖动调整宽度"
    >
      <div className="absolute inset-y-0 left-0 right-0 transition-colors group-hover:bg-(--accent) group-active:bg-(--accent)" />
    </div>
  )
}
