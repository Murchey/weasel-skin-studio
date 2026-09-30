import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastCtx = createContext(null)

let seq = 0

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setItems((list) => list.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (message, opts = {}) => {
      const id = ++seq
      const item = {
        id,
        message: String(message ?? ''),
        title: opts.title || '',
        variant: opts.variant || 'info',
        timeout: opts.timeout ?? 3500,
      }
      setItems((list) => [...list, item])
      const timer = setTimeout(() => dismiss(id), item.timeout)
      timers.current.set(id, timer)
      return id
    },
    [dismiss],
  )

  const api = useMemo(() => {
    const base = (message, opts) => push(message, opts)
    base.success = (message, opts) => push(message, { ...opts, variant: 'success' })
    base.danger = (message, opts) => push(message, { ...opts, variant: 'danger' })
    base.warning = (message, opts) => push(message, { ...opts, variant: 'warning' })
    base.info = (message, opts) => push(message, { ...opts, variant: 'info' })
    base.dismiss = dismiss
    return base
  }, [push, dismiss])

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div
        className="fixed right-4 bottom-4 z-[9999] flex w-[320px] flex-col gap-2"
        role="region"
        aria-label="通知"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto overflow-hidden rounded-xl border px-3 py-2.5 shadow-lg"
            style={{
              background:
                t.variant === 'success'
                  ? 'oklch(0.95 0.05 145)'
                  : t.variant === 'danger'
                    ? 'oklch(0.95 0.05 25)'
                    : t.variant === 'warning'
                      ? 'oklch(0.95 0.08 85)'
                      : 'oklch(0.97 0 0)',
              borderColor:
                t.variant === 'success'
                  ? 'oklch(0.6 0.12 145)'
                  : t.variant === 'danger'
                    ? 'oklch(0.6 0.15 25)'
                    : t.variant === 'warning'
                      ? 'oklch(0.7 0.12 85)'
                      : 'oklch(0.88 0 0)',
              color: 'oklch(0.2 0 0)',
            }}
          >
            {t.title ? (
              <div className="mb-0.5 text-sm font-semibold">{t.title}</div>
            ) : null}
            <div className="text-xs leading-relaxed">{t.message}</div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) {
    const noop = () => {}
    return Object.assign(noop, {
      success: noop,
      danger: noop,
      warning: noop,
      info: noop,
      dismiss: noop,
    })
  }
  return ctx
}
