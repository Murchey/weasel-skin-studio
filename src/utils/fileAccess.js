/**
 * weasel.yaml 文件访问
 * - Tauri 桌面：dialog + fs 插件（真实路径读写）
 * - 浏览器：File System Access API / input 回退
 */

function isTauri() {
  return typeof window !== 'undefined' && !!(window.__TAURI_INTERNALS__ || window.__TAURI__)
}

export function supportsFileSystemAccess() {
  return isTauri() || (typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function')
}

export function canWriteLocal() {
  return isTauri() || typeof window !== 'undefined'
}

async function tauriDeps() {
  const dialog = await import('@tauri-apps/plugin-dialog')
  const fs = await import('@tauri-apps/plugin-fs')
  return { dialog, fs }
}

/**
 * 打开 weasel.yaml，返回 { handle, text, name, path, writable }
 * Tauri 下 handle 为路径字符串，可写
 */
export async function openWeaselFileDialog() {
  if (isTauri()) {
    const { dialog, fs } = await tauriDeps()
    const path = await dialog.open({
      multiple: false,
      filters: [{ name: 'Weasel 配置', extensions: ['yaml', 'yml', 'txt'] }],
    })
    if (!path) throw new Error('已取消')
    const text = await fs.readTextFile(path)
    const name = String(path).split(/[\\/]/).pop() || 'weasel.yaml'
    return { handle: path, text, name, path: String(path), writable: true }
  }

  // 浏览器
  if (typeof window.showOpenFilePicker === 'function') {
    const [fh] = await window.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: 'Weasel 配置',
          accept: { 'text/yaml': ['.yaml', '.yml'], 'text/plain': ['.yaml', '.yml', '.txt'] },
        },
      ],
    })
    const file = await fh.getFile()
    const text = await file.text()
    return { handle: fh, text, name: file.name, path: file.name, writable: true }
  }

  // input 回退（只读）
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.yaml,.yml,.txt'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        reject(new Error('已取消'))
        return
      }
      const text = await file.text()
      resolve({ handle: null, text, name: file.name, path: file.name, writable: false })
    }
    input.oncancel = () => reject(new Error('已取消'))
    input.click()
  })
}

/** 写入已绑定的 weasel 文件 */
export async function writeWeaselFile(handle, text) {
  if (handle == null) throw new Error('无写入句柄，请重新打开文件')

  if (isTauri() && typeof handle === 'string') {
    const { fs } = await tauriDeps()
    await fs.writeTextFile(handle, text)
    return true
  }

  // File System Access API
  if (handle.createWritable) {
    const writable = await handle.createWritable()
    await writable.write(text)
    await writable.close()
    return true
  }

  throw new Error('当前环境无法写回文件')
}

/** 下载文件（浏览器）或另存为（Tauri） */
export async function downloadWeaselFile(filename, text) {
  if (isTauri()) {
    const { dialog, fs } = await tauriDeps()
    const path = await dialog.save({
      defaultPath: filename,
      filters: [{ name: 'YAML', extensions: ['yaml', 'yml'] }],
    })
    if (!path) return false
    await fs.writeTextFile(path, text)
    return true
  }

  const blob = new Blob([text], { type: 'text/yaml;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename || 'weasel.yaml'
  a.click()
  URL.revokeObjectURL(a.href)
  return true
}

/** 兼容旧接口 */
export async function readWeaselFile() {
  return openWeaselFileDialog()
}

export const WEASEL_PATH_HINTS = [
  {
    id: 'appdata',
    label: 'Roaming 用户目录',
    hint: '%APPDATA%\\Rime\\weasel.yaml',
  },
]
