import { useEffect, useRef } from 'react'
import { useSkin } from '../store/skinStore.jsx'

function isTauri() {
  return typeof window !== 'undefined' && !!(window.__TAURI_INTERNALS__ || window.__TAURI__)
}

/**
 * 退出前检查未保存方案
 * - 无未保存：直接关闭
 * - 有未保存：询问「退出 / 取消」
 */
export function useUnsavedExitGuard() {
  const { state } = useSkin()
  const dirtyRef = useRef(false)
  dirtyRef.current = !!state.dirty

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = '有未保存的方案，确定退出吗？'
      return e.returnValue
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    let unlisten = null
    let disposed = false

    ;(async () => {
      if (!isTauri()) return
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        const win = getCurrentWindow()
        const off = await win.onCloseRequested(async (event) => {
          // 无未保存修改：放行系统关闭
          if (!dirtyRef.current) return

          // 有未保存：先拦住，再询问
          event.preventDefault()
          let ok = true
          try {
            const { confirm } = await import('@tauri-apps/plugin-dialog')
            ok = await confirm('有未保存的方案，确定退出吗？', {
              title: '退出确认',
              kind: 'warning',
              okLabel: '退出',
              cancelLabel: '取消',
            })
          } catch {
            ok = true
          }
          if (!ok) return

          // 确认退出：强制销毁窗口（不走 closeRequested，避免再次拦截）
          try {
            await win.destroy()
          } catch {
            try {
              await win.close()
            } catch {
              /* ignore */
            }
          }
        })
        if (disposed) {
          if (typeof off === 'function') off()
        } else {
          unlisten = off
        }
      } catch {
        /* 非 Tauri 环境 */
      }
    })()

    return () => {
      disposed = true
      window.removeEventListener('beforeunload', onBeforeUnload)
      if (typeof unlisten === 'function') unlisten()
    }
  }, [])
}
