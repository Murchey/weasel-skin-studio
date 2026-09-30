import { useMemo } from 'react'
import { useSkin } from '../store/skinStore.jsx'
import { useInspect, useInspectStyle } from '../hooks/useInspect.jsx'
import { toCss } from '../utils/color.js'

function ptToPx(pt, fallback = 14) {
  const n = Number(pt)
  return Number.isFinite(n) ? Math.round(n * (96 / 72)) : fallback
}

/**
 * Weasel-accurate candidate window preview.
 *
 * inline_preedit: true  → 编码显示在「输入框」光标处（行内）
 * inline_preedit: false → 编码显示在候选窗顶部（独立预编辑区）
 *
 * horizontal: true      → 候选横排
 * horizontal: false     → 候选竖排（vertical_text 再决定文字方向）
 */
export default function LivePreview() {
  const { state, activeScheme, setSample } = useSkin()
  const { inspect } = useInspect()
  const style = state.style
  const colors = activeScheme?.colors || {}
  const L = style.layout || {}

  const WIN_KEYS = [
    'border_width',
    'corner_radius',
    'margin_x',
    'margin_y',
    'shadow_radius',
    'window',
    'back_color',
    'border_color',
    'shadow_color',
    'candidate_back_color',
    'candidate_border_color',
    'font_point',
  ]
  const inspHit = (keys) => {
    if (!inspect) return false
    return Array.isArray(keys) ? keys.includes(inspect) : keys === inspect
  }
  const inspStyle = (keys, soft = false) => {
    if (!inspHit(keys)) return undefined
    return {
      outline: soft ? '2px dashed #3b82f6' : '2px solid #3b82f6',
      outlineOffset: soft ? 3 : 1,
      boxShadow: soft
        ? '0 0 0 4px rgba(59,130,246,0.18)'
        : '0 0 0 3px rgba(59,130,246,0.35)',
      position: 'relative',
      zIndex: 2,
    }
  }
  const inspTag = (keys, label) =>
    inspHit(keys) ? (
      <span
        style={{
          position: 'absolute',
          top: -10,
          left: 8,
          zIndex: 3,
          background: '#3b82f6',
          color: '#fff',
          fontSize: 10,
          lineHeight: '16px',
          padding: '0 6px',
          borderRadius: 4,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        {label}
      </span>
    ) : null

  const isHorizontal = !!(style.horizontal && !style.vertical_text)
  const inlinePreedit = !!style.inline_preedit

  const css = (key, fallback = 'transparent') => {
    const c = colors[key]
    return c ? toCss(c) : fallback
  }

  const fontPx = ptToPx(style.font_point)
  const labelPx = ptToPx(style.label_font_point, 12)
  const commentPx = ptToPx(style.comment_font_point, 12)
  // Weasel Layout.cpp / StandardLayout.cpp
  // - hilite_spacing: mark/label/text/comment 间距
  // - hilite_padding_x/y: 选中块 InflateRect（文字到高亮边缘）
  // - candidate_spacing: 候选之间
  // - real_margin = max(|margin|, hilite_padding)
  const hiliteGap = L.hilite_spacing ?? 4
  const hilitePadX = L.hilite_padding_x ?? L.hilite_padding ?? 2
  const hilitePadY = L.hilite_padding_y ?? L.hilite_padding ?? 2
  const candGap = L.candidate_spacing ?? 5
  const realMarginX = Math.max(Math.abs(L.margin_x ?? 12), hilitePadX)
  const realMarginY = Math.max(Math.abs(L.margin_y ?? 12), hilitePadY)

  const windowStyle = useMemo(() => {
    const border = css('border_color', 'rgba(196, 160, 0, 0.9)')
    const shadowColor = css('shadow_color', 'transparent')
    const borderW = Number(L.border_width ?? L.border ?? 3)
    // Weasel: round_corner_ex = corner_radius || round_corner（窗体圆角）
    const winRadius = L.corner_radius ?? L.round_corner ?? 4
    const shadowR = Number(L.shadow_radius ?? 0)
    const shadowX = Number(L.shadow_offset_x ?? 4)
    const shadowY = Number(L.shadow_offset_y ?? 4)
    // Weasel 仅在 shadow_radius!=0 且 shadow_color 非透明时画阴影
    const showShadow =
      shadowR > 0 && shadowColor && shadowColor !== 'transparent'

    return {
      background: css('back_color', 'rgba(28, 28, 28, 0.96)'),
      // border_width=0 必须用 ?? / Number，|| 会把 0 当未设置
      border: borderW <= 0 ? 'none' : `${borderW}px solid ${border}`,
      borderRadius: `${winRadius}px`,
      boxShadow: showShadow
        ? `${shadowX}px ${shadowY}px ${shadowR * 2}px ${shadowColor}`
        : 'none',
      // Weasel Layout.cpp: real_margin 在窗体内侧（内容相对边框内缩）
      // real_margin = max(|margin|, hilite_padding)
      padding: `${realMarginY}px ${realMarginX}px`,
      color: css('text_color', '#ddd'),
      fontFamily: style.font_face || 'Segoe UI, Microsoft YaHei, sans-serif',
    }
  }, [colors, L, style.font_face, realMarginX, realMarginY])

  const preeditColor = css('text_color', '#ddd')
  const preeditHiliteColor = css('hilited_text_color', '#fff')
  const preeditHiliteBg = css('hilited_back_color', 'transparent')

  function formatLabel(i) {
    const fmt = style.label_format || '%s'
    return fmt.replace('%s', String(i + 1))
  }

  const markVisible = !!(style.mark_text || colors.hilited_mark_color)

  const listStyle = isHorizontal
    ? {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'stretch',
        alignContent: 'stretch',
        gap: `${candGap}px`,
        width: '100%',
        minHeight: `${Math.round(fontPx * 1.7 + hilitePadY * 2)}px`,
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: `${candGap}px`,
        width: '100%',
      }

  /** 预编辑区（编码）一整块 */
  const preeditNode = (
    <span
      style={{
        borderBottom: `1px dotted ${preeditColor}`,
        color: preeditHiliteColor,
        background: preeditHiliteBg !== 'transparent' ? preeditHiliteBg : undefined,
        padding: preeditHiliteBg !== 'transparent' ? '0 2px' : 0,
      }}
    >
      {state.sampleText || 'zhongwen'}
    </span>
  )

  const caretNode = (
    <span
      style={{
        display: 'inline-block',
        width: 1,
        height: '1em',
        marginLeft: 2,
        verticalAlign: '-0.15em',
        background: preeditColor,
        opacity: 0.75,
      }}
    />
  )

  return (
    <div className="inline-block min-w-[360px] max-w-full select-none">
      {/*
        inline_preedit = true：模拟「正在打字的应用输入框」
        编码跟在光标后，候选窗在下方 —— 与真实输入位置一致
      */}
      {inlinePreedit && (
        <div
          className="mb-2 rounded-md border px-3 py-2"
          style={{
            // 模拟系统文本框（与皮肤无关的普通编辑器外观）
            background: 'rgba(255,255,255,0.92)',
            borderColor: 'rgba(0,0,0,0.18)',
            color: '#1a1a1a',
            fontSize: fontPx,
            lineHeight: 1.5,
            fontFamily: 'Segoe UI, Microsoft YaHei, sans-serif',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}
        >
          <span style={{ opacity: 0.45 }}>正在编辑的文本 </span>
          <span style={{ color: '#111' }}>{preeditNode}</span>
          {caretNode}
          <span
            className="ml-1 text-[10px]"
            style={{ opacity: 0.45, verticalAlign: 'middle' }}
          >
            ← 编码显示在输入处
          </span>
        </div>
      )}

      {/* 候选窗 */}
      <div
        style={{ ...windowStyle, ...inspStyle(WIN_KEYS, true), position: 'relative' }}
      >
        {inspTag(WIN_KEYS, '窗口 / 边距 / 边框 / 阴影')}
        {/*
          inline_preedit = false：编码显示在候选窗内（用户反馈的「字母跑进输入法」）
        */}
        {(!inlinePreedit || inspHit(['text_color', 'hilited_text_color', 'hilited_back_color', 'hilited_shadow_color', 'preedit'])) && (
          <div
            style={{
              ...inspStyle(
                ['text_color', 'hilited_text_color', 'hilited_back_color', 'hilited_shadow_color', 'preedit'],
                true,
              ),
              position: 'relative',
              color: preeditColor,
              fontSize: fontPx,
              lineHeight: 1.45,
              fontFamily: style.font_face || undefined,
              borderBottom: `1px solid ${css('border_color', 'rgba(255,255,255,0.08)')}`,
            }}
          >
            {inspTag(['text_color', 'hilited_text_color', 'hilited_back_color', 'preedit'], '编码 / 预编辑')}
            {preeditNode}
            {caretNode}
            <span
              className="ml-1 text-[10px]"
              style={{ opacity: 0.5, verticalAlign: 'middle' }}
            >
              ← 编码显示在候选窗内
            </span>
          </div>
        )}

        <div
          style={{ ...listStyle, ...inspStyle(['candidate_spacing'], true), position: 'relative' }}
        >
          {inspTag(['candidate_spacing'], '候选间距')}
          {state.sampleCandidates.map((c, i) => {
            const selected = i === state.selectedCandidate
            const bg = selected
              ? css('hilited_candidate_back_color', 'rgba(196, 160, 0, 0.95)')
              : css('candidate_back_color', 'transparent')
            const fg = selected
              ? css('hilited_candidate_text_color', css('candidate_text_color', '#1a1a1a'))
              : css('candidate_text_color', css('text_color', '#ddd'))
            const labelColor = selected
              ? css('hilited_candidate_label_color', css('hilited_label_color', fg))
              : css('label_color', fg)
            const commentColor = selected
              ? css('hilited_comment_text_color', css('comment_color', fg))
              : css('comment_color', css('text_color', '#999'))
            const borderColor = selected
              ? css('hilited_candidate_border_color', 'transparent')
              : css('candidate_border_color', 'transparent')

            return (
              <div
                key={i}
                onClick={() => setSample(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: hiliteGap,
                  margin: 0,
                  alignSelf: 'stretch',
                  height: '100%',
                  minHeight: `${Math.round(fontPx * 1.7)}px`,
                  padding: `${hilitePadY}px ${hilitePadX}px`,
                  borderRadius: `${L.round_corner ?? L.corner_radius ?? 4}px`,
                  position: 'relative',
                  ...(selected
                    ? inspStyle(
                        [
                          'round_corner',
                          'hilite_padding',
                          'hilite_padding_x',
                          'hilite_padding_y',
                          'hilited_candidate_back_color',
                          'hilited_candidate_text_color',
                          'hilited_candidate_border_color',
                          'hilited_candidate_shadow_color',
                          'hilited_candidate_label_color',
                          'hilited_label_color',
                          'hilited_comment_text_color',
                          'hilited_mark_color',
                          'label_font_point',
                          'comment_font_point',
                        ],
                        false,
                      )
                    : inspStyle(
                        [
                          'hilite_spacing',
                          'label_color',
                          'candidate_text_color',
                          'candidate_back_color',
                          'candidate_border_color',
                          'candidate_shadow_color',
                          'comment_text_color',
                          'label_format',
                          'label_font_point',
                          'comment_font_point',
                        ],
                        true,
                      )),
                  background: bg,
                  color: fg,
                  border:
                    borderColor !== 'transparent'
                      ? `1px solid ${borderColor}`
                      : '1px solid transparent',
                  cursor: 'default',
                  lineHeight: 1.3,
                  whiteSpace: 'nowrap',
                  boxSizing: 'border-box',
                }}
              >
                {selected
                  ? inspTag(
                      [
                        'round_corner',
                        'hilite_padding',
                        'hilited_candidate_back_color',
                        'hilited_candidate_text_color',
                        'hilited_label_color',
                      ],
                      '选中高亮',
                    )
                  : inspTag(['label_color', 'candidate_text_color', 'comment_text_color'], '候选标签/文字')}
                {markVisible && selected && (
                  <span
                    style={{
                      color: css('hilited_mark_color', fg),
                      fontSize: fontPx,
                      lineHeight: 1,
                    }}
                  >
                    {style.mark_text || ''}
                  </span>
                )}
                <span
                  style={{
                    color: labelColor,
                    fontSize: labelPx,
                    fontFamily: style.label_font_face || undefined,
                  }}
                >
                  {formatLabel(i)}
                </span>
                <span style={{ fontSize: fontPx }}>{c.text}</span>
                {c.comment ? (
                  <span
                    style={{
                      color: commentColor,
                      fontSize: commentPx,
                      fontFamily: style.comment_font_face || undefined,
                      opacity: 0.92,
                    }}
                  >
                    {c.comment}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>

        {(colors.prevpage_color || colors.nextpage_color) && (
          <div
            className="mt-1.5 flex items-center justify-end gap-2 px-2 pb-1.5"
            style={{
              fontSize: Math.max(10, fontPx - 3),
              position: 'relative',
              ...inspStyle(['prevpage_color', 'nextpage_color'], true),
            }}
          >
            <span style={{ color: css('prevpage_color', css('text_color')) }}>◀</span>
            <span style={{ color: css('nextpage_color', css('text_color')) }}>▶</span>
          </div>
        )}
      </div>
    </div>
  )
}
