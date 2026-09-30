import {
  syncSchemeListInWeaselText,
  upsertSchemeInWeaselText,
  updateStyleKeysInWeaselText,
} from '../src/utils/weaselFileEdit.js'

const original = `style:
  color_scheme: alpha
  horizontal: true
  inline_preedit: true
preset_color_schemes:
  alpha:
    name: "A"
    back_color: 0x00000000
  beta:
    name: "B"
    back_color: 0x11111111
  gamma:
    name: "C"
    back_color: 0x22222222
`

let text = upsertSchemeInWeaselText(original, {
  id: 'alpha',
  name: 'A',
  color_format: 'abgr',
  colors: {},
}).text
const synced = syncSchemeListInWeaselText(text, ['alpha', 'beta'])
console.log('removed:', synced.removed)
text = updateStyleKeysInWeaselText(synced.text, {
  horizontal: true,
  inline_preedit: true,
  color_scheme: 'alpha',
}).text
console.log('--- result ---')
console.log(text)
console.log('has gamma?', text.includes('gamma'))
console.log('has beta?', text.includes('beta'))
console.log('has alpha?', text.includes('alpha:'))
