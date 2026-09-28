// Clean Tauri CLI runner (avoids polluted process.argv in some shells)
const path = require('path')
const cli = require('./node_modules/@tauri-apps/cli/main.js')

const args = process.argv.slice(2)
console.log('[tauri-runner] args:', JSON.stringify(args))
cli.run(args, 'tauri').catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
