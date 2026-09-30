/**
 * 把 package.json 的 version 同步到 tauri.conf.json 与 Cargo.toml
 * 避免只改 package.json 后 Tauri 打包失败
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const pkgPath = path.join(root, 'package.json')
const tauriPath = path.join(root, 'src-tauri', 'tauri.conf.json')
const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml')

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const version = pkg.version
if (!version) {
  console.error('[sync-version] package.json has no version')
  process.exit(1)
}

const tauri = JSON.parse(fs.readFileSync(tauriPath, 'utf8'))
if (tauri.version !== version) {
  tauri.version = version
  fs.writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + '\n', 'utf8')
  console.log('[sync-version] tauri.conf.json ->', version)
} else {
  console.log('[sync-version] tauri.conf.json already', version)
}

let cargo = fs.readFileSync(cargoPath, 'utf8')
const verRe = /^version\s*=\s*"[^"]*"/m
if (verRe.test(cargo)) {
  const next = cargo.replace(verRe, `version = "${version}"`)
  if (next !== cargo) {
    fs.writeFileSync(cargoPath, next, 'utf8')
    console.log('[sync-version] Cargo.toml ->', version)
  } else {
    console.log('[sync-version] Cargo.toml already', version)
  }
} else {
  console.error('[sync-version] Cargo.toml has no version field')
  process.exit(1)
}

console.log('[sync-version] done', version)
