import { useMemo } from 'react'
import { useSkin } from '../store/skinStore.jsx'
import { toCss } from '../utils/color.js'

function ptToPx(pt, fallback = 14) {
  const n = Number(pt)
  return Number.isFinite(n) ? Math.round(n * (96 / 72)) : fallback
}

export default function LivePreview() {
  const { state, activeScheme, getColor } = useSkin()
  const style = state.style
  const colors = activeScheme?.colors || {}
  const L = style.layout || {}

  const isHorizontal = !!(style.horizontal && !style.vertical_text)

  const css = (key, fallback = 'transparent') => {
    const c = colors[key]
    return c ? toCss(c) : fallback
  }

  const windowCss = useMemo(() => {
    const bg = css('back_color', 'rgba(255,255,255,0.96)')
    const border = css('border_color', 'rgba(0,0,0,0.12)')
    return {
      background: bg,
      border: `${L.border_width || 0}px solid ${border}`,
      borderRadius: `${L.corner_radius || 0}px`,
      boxShadow: `0 ${Math.max(2, (L.shadow_radius || 6) / 2)}px ${(L.shadow_radius || 6) * 2}px rgba(0,0,0,0.18)`,
      padding: `${L.margin_y || 6}px ${L.margin_x || 8}px`,
      color: css('text_color', '#111'),
      fontFamily: style.font_face || 'Segoe UI, sans-serif',
    }
  }, [colors, L, style.font_face])

  const preeditCss = {
    color: css('preedit_color', css('text_color', '#111')),
    background: css('preedit_back_color', 'transparent'),
    fontSize: ptToPx(style.font_point),
  }

  const preeditHiliteCss = {
    color: css('hilited_preedit_color', css('preedit_color', '#111')),
    background: css('hilited_preedit_back_color', 'rgba(0,0,0,0.08)'),
    borderRadius: `${L.round_corner || 4}px`,
    padding: '0 4px',
  }

  const padX = () => `${L.hilite_padding ?? 4}px`
  const padY = () => `${Math.max(2, (L.hilite_padding ?? 4) / 2)}px`

  function candidateWrapStyle(index) {
    const selected = index === state.selectedCandidate
    return {
      display: 'flex',
      alignItems: 'center',
      gap: `${L.hilite_spacing || 4}px`,
      padding: `${padY()} ${padX()}`,
      borderRadius: `${L.round_corner || 4}px`,
      background: selected ? css('hilited_candidate_back_color', 'rgba(37,99,235,0.15)') : 'transparent',
      marginBottom: `${L.candidate_spacing || 2}px`,
      cursor: 'default',
    }
  }

  function labelStyle(index) {
    const selected = index === state.selectedCandidate
    return {
      color: selected
        ? css('hilited_candidate_label_color', css('label_color', '#2563eb'))
        : css('label_color', '#666'),
      fontSize: ptToPx(style.label_font_point, 12),
      minWidth: 16,
      fontFamily: style.label_font_face || undefined,
    }
  }

  function textStyle(index) {
    const selected = index === state.selectedCandidate
    return {
      color: selected
        ? css('hilited_candidate_text_color', css('candidate_text_color', css('text_color', '#111')))
        : css('candidate_text_color', css('text_color', '#111')),
      fontSize: ptToPx(style.font_point),
    }
  }

  function commentStyle(index) {
    const selected = index === state.selectedCandidate
    return {
      color: selected
        ? css('hilited_candidate_comment_color', css('comment_color', '#888'))
        : css('comment_color', '#888'),
      fontSize: ptToPx(style.comment_font_point, 12),
      fontFamily: style.comment_font_face || undefined,
    }
  }

  function formatLabel(i) {
    const fmt = style.label_format || '%s.'
    return fmt.replace('%s', String(i + 1))
  }

  const showMark = !!(state.selectedCandidate >= 0 && colors.hilited_mark_color)
  const markCss = {
    color: css('hilited_mark_color', css('hilited_candidate_text_color', '#2563eb')),
    fontSize: ptToPx(style.font_point),
    marginRight: 2,
  }

  const pageColor = css('nextpage_color', css('text_color', 'inherit'))
  const prevColor = css('prevpage_color', css('text_color', 'inherit'))
  const candidates = state.sampleCandidates

  return (
    <div
      className="inline-block min-w-[320px] max-w-full"
      style={windowCss}
      onClick={() => {}}
    >
      {!style.inline_preedit && (
        <div className="mb-2 flex items-center gap-1" style={preeditCss}>
          <span style={preeditHiliteCss}>zhongwen</span>
          <span className="opacity-70">|</span>
        </div>
      )}

      <div
        className={
          isHorizontal ? 'flex flex-wrap items-stretch gap-1' : 'flex flex-col items-stretch'
        }
      >
        {candidates.map((c, i) => (
          <div
            key={i}
            style={candidateWrapStyle(i)}
            onMouseEnter={() => state.selectedCandidate !== i && null}
          >
            {showMark && i === state.selectedCandidate && (
              <span style={markCss}>{style.mark_text || '▌'}</span>
            )}
            <span style={labelStyle(i)}>{formatLabel(i)}</span>
            <span style={textStyle(i)}>{c.text}</span>
            {c.comment ? <span style={commentStyle(i)}>{c.comment}</span> : null}
          </div>
        ))}
      </div>

      <div className="mt-1 flex items-center justify-end gap-3 text-xs opacity-80">
        <span style={{ color: prevColor }}>◀</span>
        <span style={{ color: pageColor }}>▶</span>
      </div>
    </div>
  )
}
