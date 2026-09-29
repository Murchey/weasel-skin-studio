import { useMemo } from 'react'
import { useSkin } from '../store/skinStore.jsx'
import { toCss } from '../utils/color.js'

function ptToPx(pt, fallback = 14) {
  const n = Number(pt)
  return Number.isFinite(n) ? Math.round(n * (96 / 72)) : fallback
}

/**
 * Weasel-accurate candidate window:
 *
 *   xiao lang hao shu ru fa   ← composition, dotted underline
 *   ┌─────────────────────┐
 *   │[1 小狼毫输入法] 2 …  │  ← border, selected hilite
 *   └─────────────────────┘
 *
 * - selected outer margin = 0
 * - hilite_padding = inner padding of the selected box
 * - hilite_spacing = gap between mark / label / text / comment
 * - candidate_spacing = gap between candidates
 */
export default function LivePreview() {
  const { state, activeScheme, setSample } = useSkin()
  const style = state.style
  const colors = activeScheme?.colors || {}
  const L = style.layout || {}

  const isHorizontal = !!(style.horizontal && !style.vertical_text)

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
      // 候选窗外框：padding 固定 0（与 Weasel 对齐）
      padding: 0,
      color: css('text_color', '#ddd'),
      fontFamily: style.font_face || 'Segoe UI, Microsoft YaHei, sans-serif',
    }
  }, [colors, L, style.font_face])

  // composition / preedit — dotted underline like Weasel
  const preeditColor = css('preedit_color', css('text_color', '#ddd'))
  const preeditHiliteColor = css(
    'hilited_text_color',
    css('hilited_preedit_color', css('preedit_color', '#fff')),
  )
  const preeditHiliteBg = css('hilited_back_color', 'transparent')
  const preeditBorder = css('hilited_preedit_back_color', 'transparent')

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

  return (
    <div className="inline-block min-w-[360px] max-w-full select-none">
      {/* composition / preedit — OUTSIDE the candidate window (like 终末地) */}
      <div
        className="mb-1.5 px-0.5"
        style={{
          color: preeditColor,
          fontSize: fontPx,
          lineHeight: 1.45,
          fontFamily: style.font_face || undefined,
        }}
      >
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
      </div>

      {/* candidate window — gold border + dark fill */}
      <div style={windowStyle}>
        <div style={listStyle}>
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
                  // stretch to full cell so the hilite background fills the node
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
            className="mt-1.5 flex items-center justify-end gap-2"
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
