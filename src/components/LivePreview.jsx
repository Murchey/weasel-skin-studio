import { useMemo } from 'react'
import { useSkin } from '../store/skinStore.jsx'
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
  const style = state.style
  const colors = activeScheme?.colors || {}
  const L = style.layout || {}

  const isHorizontal = !!(style.horizontal && !style.vertical_text)
  const inlinePreedit = !!style.inline_preedit

  const css = (key, fallback = 'transparent') => {
    const c = colors[key]
    return c ? toCss(c) : fallback
  }

  const fontPx = ptToPx(style.font_point)
  const labelPx = ptToPx(style.label_font_point, 12)
  const commentPx = ptToPx(style.comment_font_point, 12)
  const hiliteGap = L.hilite_spacing ?? 6
  const hilitePad = L.hilite_padding ?? 0
  const candGap = L.candidate_spacing ?? 12

  const windowStyle = useMemo(() => {
    const border = css('border_color', 'rgba(196, 160, 0, 0.9)')
    return {
      background: css('back_color', 'rgba(28, 28, 28, 0.96)'),
      border: `${L.border_width || 1}px solid ${border}`,
      borderRadius: `${L.corner_radius || 10}px`,
      boxShadow:
        (L.shadow_radius || 0) > 0
          ? `0 ${L.shadow_offset_y ?? 4}px ${(L.shadow_radius || 6) * 2}px rgba(0,0,0,0.28)`
          : '0 10px 28px rgba(0,0,0,0.22)',
      padding: 0,
      color: css('text_color', '#ddd'),
      fontFamily: style.font_face || 'Segoe UI, Microsoft YaHei, sans-serif',
    }
  }, [colors, L, style.font_face])

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
        minHeight: `${Math.round(fontPx * 1.7 + hilitePad * 2)}px`,
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
      <div style={windowStyle}>
        {/*
          inline_preedit = false：编码显示在候选窗内（用户反馈的「字母跑进输入法」）
        */}
        {!inlinePreedit && (
          <div
            className="px-2 pt-2 pb-1"
            style={{
              color: preeditColor,
              fontSize: fontPx,
              lineHeight: 1.45,
              fontFamily: style.font_face || undefined,
              borderBottom: `1px solid ${css('border_color', 'rgba(255,255,255,0.08)')}`,
            }}
          >
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

        <div style={listStyle} className={!inlinePreedit ? 'p-0' : undefined}>
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
                  padding: `0 ${hilitePad}px`,
                  borderRadius: `${L.round_corner || 6}px`,
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
            style={{ fontSize: Math.max(10, fontPx - 3) }}
          >
            <span style={{ color: css('prevpage_color', css('text_color')) }}>◀</span>
            <span style={{ color: css('nextpage_color', css('text_color')) }}>▶</span>
          </div>
        )}
      </div>
    </div>
  )
}
