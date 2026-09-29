from pathlib import Path

p = Path("src/utils/fileAccess.js")
t = p.read_text(encoding="utf-8")

addition = r'''

/** 尝试重新部署小狼毫，使 weasel.yaml 更改生效 */
export async function redeployWeasel() {
  if (!isTauri()) return { ok: false, reason: 'not-tauri' }
  try {
    const { Command } = await import('@tauri-apps/plugin-shell')
    const script = [
      'echo $candidates = @(',
      '  "${env:ProgramFiles}\\Rime\\*\\WeaselDeployer.exe",',
      '  "${env:ProgramFiles(x86)}\\Rime\\*\\WeaselDeployer.exe",',
      '  "${env:LOCALAPPDATA}\\Programs\\Rime\\*\\WeaselDeployer.exe"',
      ')',
      'foreach ($c in $candidates) {',
      '  $p = Get-Item $c -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName',
      '  if ($p) { & $p /deploy; Write-Output ("DEPLOYED:" + $p); exit 0 }',
      '}',
      'Write-Output NO_DEPLOYER',
    ].join('\n')
    const cmd = Command.create('run-powershell', ['-NoProfile', '-Command', script])
    const out = await cmd.execute()
    const stdout = (out.stdout || '') + (out.stderr || '')
    if (stdout.includes('DEPLOYED:')) return { ok: true, detail: stdout.trim() }
    return { ok: false, reason: 'deployer-not-found', detail: stdout.trim() }
  } catch (e) {
    return { ok: false, reason: String(e && e.message ? e.message : e) }
  }
}
'''

if "redeployWeasel" not in t:
    t = t.rstrip() + "\n" + addition
    p.write_text(t, encoding="utf-8")
    print("added redeployWeasel")
else:
    print("already has redeployWeasel")
