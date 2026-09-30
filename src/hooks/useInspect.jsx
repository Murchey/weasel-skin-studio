import { createContext, useContext, useState, useCallback, useMemo } from 'react'

const InspectContext = createContext(null)

export function InspectProvider({ children }) {
  const [inspect, setInspect] = useState(null)
  const show = useCallback((key) => setInspect(key || null), [])
  const hide = useCallback(() => setInspect(null), [])
  const value = useMemo(() => ({ inspect, show, hide }), [inspect, show, hide])
  return <InspectContext.Provider value={value}>{children}</InspectContext.Provider>
}

export function useInspect() {
  return (
    useContext(InspectContext) || {
      inspect: null,
      show: () => {},
      hide: () => {},
    }
  )
}

/**
 * 生成 DevTools 式高亮：内联 outline + 半透明底（不依赖 CSS 类）
 * keys: string | string[]
 */
export function useInspectStyle(keys) {
  const { inspect } = useInspect()
  const hit = useMemo(() => {
    if (!inspect) return false
    if (Array.isArray(keys)) return keys.includes(inspect)
    return keys === inspect
  }, [inspect, keys])

  return useMemo(() => {
    if (!hit) return undefined
    return {
      outline: '2px solid #3b82f6',
      outlineOffset: 2,
      boxShadow: '0 0 0 4px rgba(59,130,246,0.35)',
      background: undefined, // 由调用方决定是否覆盖背景
      position: 'relative',
      zIndex: 2,
    }
  }, [hit])
}

export function InspectLabel({ target, className, children, title }) {
  const { show, hide } = useInspect()
  return (
    <span
      className={className}
      title={title || '悬停可在预览中高亮该设置作用区域'}
      onMouseEnter={() => show(target)}
      onMouseLeave={hide}
      onFocus={() => show(target)}
      onBlur={hide}
      tabIndex={0}
    >
      {children}
    </span>
  )
}
