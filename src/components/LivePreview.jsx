import { useMemo } from 'react'
import { useSkin } from '../store/skinStore.jsx'
import { toCss } from '../utils/color.js'

function ptToPx(pt, fallback = 14) {
  const n = Number(pt)
  return Number.isFinite(n) ? Math.round(n * (96 / 72)) : fallback
}

/**
 * Live preview aligned with Weasel:
 * - candidate / selected hilite outer margin is 0
 * - hilite_padding is inner padding of the highlight box
 * - hilite_spacing is the gap between mark/label/text/comment
 * - candidate_spacing is the gap between candidate items
 */
export default function LivePreview() {
  const { state, activeScheme } = useSkin()
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

  const windowStyle = useMemo(() => {
    const border = css('border_color', 'rgba(0,0,0,0.12)')
    return {
      background: css('back_color', 'rgba(255,255,255,0.96)'),
      border: `${L.border_width || 0}px solid ${border}`,
      borderRadius: `${L.corner_radius || 0}px`,
      boxShadow:
        (L.shadow_radius || 0) > 0
          ? `0 ${L.shadow_offset_y ?? 4}px ${(L.shadow_radius || 6) * 2}px rgba(0,0,0,0.22)`
          : '0 8px 28px rgba(0,0,0,0.18)',
      // window content margin — NOT candidate inner padding
      padding: `${L.margin_y ?? 8}px ${L.margin_x ?? 8}px`,
      color: css('text_color', '#111'),
      fontFamily: style.font_face || 'Segoe UI, sans-serif',
    }
  }, [colors, L, style.font_face])

  const preeditStyle = {
    color: css('preedit_color', css('text_color', '#111')),
    background: css('preedit_back_color', 'transparent'),
    fontSize: fontPx,
  }

  const preeditHiliteStyle = {
    color: css('hilited_text_color', css('hilited_preedit_color', css('preedit_color', '#111'))),
    background: css('hilited_back_color', css('hilited_preedit_back_color', 'rgba(0,0,0,0.08)')),
    borderRadius: `${L.round_corner || 4}px`,
    // Weasel preedit hilite is tight — no inner padding
    padding: 0,
    lineHeight: 1.35,
  }

  function formatLabel(i) {
    const fmt = style.label_format || '%s.'
    return fmt.replace('%s', String(i + 1))
  }

  const markVisible = state.selectedCandidate >= 0 && (style.mark_text || colors.hilited_mark_color)

  function markStyle(selected) {
    return {
      color: css('hilited_mark_color', css('hilited_candidate_text_color', css('text_color'))),
      fontSize: fontPx,
      lineHeight: 1.2,
      // no extra inner pad
      padding: 0,
    }
  }

  function labelStyle(selected) {
    return {
      color: selected
        ? css('hilited_label_color', css('hilited_candidate_label_color', css('label_color', '#2563eb')))
        : css('label_color', '#666'),
      fontSize: labelPx,
      lineHeight: 1.25,
      fontFamily: style.label_font_face || undefined,
      padding: 0,
    }
  }

  function textStyle(selected) {
    return {
      color: selected
        ? css('hilited_candidate_text_color', css('candidate_text_color', css('text_color', '#111')))
        : css('candidate_text_color', css('text_color', '#111')),
      fontSize: fontPx,
      lineHeight: 1.35,
      padding: 0,
    }
  }

  function commentStyle(selected) {
    return {
      color: selected
        ? css('hilited_comment_text_color', css('hilited_candidate_comment_color', css('comment_color', '#888')))
        : css('comment_color', '#888'),
      fontSize: commentPx,
      lineHeight: 1.25,
      fontFamily: style.comment_font_face || undefined,
      padding: 0,
    }
  }

  function rowVars(index) {
    const selected = index === state.selectedCandidate
    return {
      '--hilite-spacing': `${L.hilite_spacing ?? 6}px`,
      '--hilite-padding': `${L.hilite_padding ?? 0}px`,
      '--hilite-radius': `${L.round_corner || 0}px`,
      '--hilite-bg': selected
        ? css('hilited_candidate_back_color', 'rgba(245, 158, 11, 0.28)')
        : 'transparent',
      '--hilite-fg': selected
        ? css('hilited_candidate_text_color', css('text_color', '#111'))
        : 'inherit',
      '--hilite-border-w': selected && colors.hilited_candidate_border_color ? '1px' : '0px',
      '--hilite-border': selected
        ? css('hilited_candidate_border_color', 'transparent')
        : 'transparent',
      '--hilite-shadow':
        selected && colors.hilited_candidate_shadow_color
          ? `0 2px 8px ${css('hilited_candidate_shadow_color', 'transparent')}`
          : 'none',
    }
  }

  const candidates = state.sampleCandidates
  const listStyle = isHorizontal
    ? {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'stretch',
        // candidate_spacing between items
        gap: `${L.candidate_spacing ?? 22}px`,
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: `${L.candidate_spacing ?? 22}px`,
      }

  return (
    <div className="inline-block min-w-[320px] max-w-full select-none" style={windowStyle}>
      {!style.inline_preedit && (
        <div
          className="mb-2 flex items-center"
          style={{ ...preeditStyle, gap: `${L.hilite_spacing ?? 6}px` }}
        >
          <span style={preeditHiliteStyle}>zhongwen</span>
          <span className="opacity-60">|</span>
        </div>
      )}

      <div style={listStyle}>
        {candidates.map((c, i) => {
          const selected = i === state.selectedCandidate
          return (
            <div
              key={i}
              className={`cand-row${selected ? ' is-selected' : ''}`}
              style={rowVars(i)}
              onClick={() => {}}
            >
              {markVisible && selected && (
                <span style={markStyle(selected)}>{style.mark_text || '▌'}</span>
              )}
              <span style={labelStyle(selected)}>{formatLabel(i)}</span>
              <span style={textStyle(selected)}>{c.text}</span>
              {c.comment ? <span style={commentStyle(selected)}>{c.comment}</span> : null}
            </div>
          )
        })}
      </div>

      <div
        className="mt-2 flex items-center justify-end gap-3 text-xs opacity-80"
        style={{ color: css('text_color', 'inherit') }}
      >
        <span style={{ color: css('prevpage_color', css('text_color')) }}>◀</span>
        <span style={{ color: css('nextpage_color', css('text_color')) }}>▶</span>
      </div>
    </div>
  )
}
