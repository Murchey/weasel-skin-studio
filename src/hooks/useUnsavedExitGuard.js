import { useEffect, useRef } from 'react'
import { useSkin } from '../store/skinStore.jsx'

function isTauri() {
  return typeof window !== 'undefined' && !!(window.__TAURI_INTERNALS__ || window.__TAURI__)
}

/**
 * 退出前检查未保存方案：
 * - Tauri：窗口关闭请求时确认
 * - 浏览器：beforeunload
 */
export function useUnsavedExitGuard() {
  const { state } = useSkin()
  const dirtyRef = useRef(false)
  dirtyRef.current = !!state.dirty

  useEffect(() => {
    // 浏览器 / 开发页
    const onBeforeUnload = (e) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = '有未保存的方案，确定退出吗？'
      return e.returnValue
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    let unlisten = null
    let cancelled = false

    // Tauri 桌面
    ;(async () => {
      if (!isTauri()) return
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        const win = getCurrentWindow()
        const off = await win.onCloseRequested(async (event) => {
          if (!dirtyRef.current) return
          // 阻止默认关闭，弹确认
          event.preventDefault()
          try {
            const { confirm } = await import('@tauri-apps/plugin-dialog')
            const ok = await confirm('有未保存的方案，确定退出吗？', {
              title: '退出确认',
              kind: 'warning',
              okLabel: '退出',
              cancelLabel: '取消',
            })
            if (ok) {
              // 确认后真正关闭
              await win.destroy()
            }
          } catch {
            // 对话框失败时允许退出，避免卡死
            await win.destroy()
          }
        })
        if (cancelled) {
          if (typeof off === 'function') off()
        } else {
          unlisten = off
        }
      } catch {
        // 非 Tauri 或 API 不可用则忽略
      }
    })()

    return () => {
      cancelled = true
      window.removeEventListener('beforeunload', onBeforeUnload)
      if (typeof unlisten === 'function') unlisten()
    }
  }, [])
}
