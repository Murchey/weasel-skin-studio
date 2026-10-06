import assert from 'node:assert/strict'
import {
  STYLE_DEFAULTS,
  exportCustomPatchYaml,
  exportStyleYaml,
  normalizeWeaselStyle,
  parseWeaselYaml,
} from '../src/utils/weaselYaml.js'
import { updateStyleKeysInWeaselText } from '../src/utils/weaselFileEdit.js'
import { formatWeaselColor, parseWeaselColor } from '../src/utils/color.js'

const normalized = normalizeWeaselStyle({
  horizontal: true,
  layout: {
    border_width: 5,
    corner_radius: 12,
    hilited_corner_radius: 8,
    hilite_padding: 6,
    margin_x: -2,
    margin_y: 0,
  },
})
assert.equal(normalized.layout.border, 5)
assert.equal(normalized.layout.border_width, 5)
assert.equal(normalized.layout.corner_radius, 12)
assert.equal(normalized.layout.round_corner, 8)
assert.equal(normalized.layout.hilite_padding_x, 6)
assert.equal(normalized.layout.hilite_padding_y, 6)
assert.equal(normalized.layout.margin_x, -6)
assert.equal(normalized.layout.margin_y, 6)
assert.ok(normalized.layout.spacing >= 12)
assert.ok(normalized.layout.candidate_spacing >= 12)

const parsed = parseWeaselYaml(`
style:
  horizontal: true
  layout:
    border_width: 7
    hilite_padding: 4
preset_color_schemes:
  demo:
    name: Demo
    color_format: rgba
    back_color: 0x112233ff
`)
assert.equal(parsed.style.layout.border, 7)
assert.equal(parsed.style.layout.hilite_padding_x, 4)

const original = `style:\n  color_scheme: demo\n  font_face: "Old"\n  layout:\n    margin_x: 4\n    border: 1\nother: true\n`
const updated = updateStyleKeysInWeaselText(original, {
  font_face: 'Microsoft YaHei',
  'layout/margin_x': -8,
  'layout/shadow_radius': 6,
}).text
assert.match(updated, /font_face: "Microsoft YaHei"/)
assert.match(updated, /margin_x: -8/)
assert.match(updated, /shadow_radius: 6/)
assert.match(updated, /other: true/)

const patch = exportCustomPatchYaml({ ...STYLE_DEFAULTS, ...normalized }, [
  { id: 'demo', name: 'Demo', color_format: 'rgba', colors: {} },
])
assert.match(patch, /"style\/layout\/border"/)
assert.doesNotMatch(patch, /style\/layout\/border_width/)
assert.match(patch, /"style\/font_face"/)

for (const format of ['abgr', 'rgba', 'argb']) {
  const value = formatWeaselColor({ r: 0x12, g: 0x34, b: 0x56, a: 0x78 }, format)
  assert.deepEqual(parseWeaselColor(value, format), { r: 0x12, g: 0x34, b: 0x56, a: 0x78 })
}
const fullStyle = exportStyleYaml({
  ...STYLE_DEFAULTS,
  ...normalized,
  layout: { ...STYLE_DEFAULTS.layout, ...normalized.layout, baseline: 115, linespacing: 130 },
})
assert.match(fullStyle, /baseline: 115/)
assert.match(fullStyle, /linespacing: 130/)
assert.match(fullStyle, /display_tray_icon: true/)

console.log('style checks passed')
