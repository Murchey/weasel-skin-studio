# Weasel Skin Studio

小狼毫（Weasel）输入法 **可视化皮肤调色工具**。  
基于 **Tauri 2 + React 19 + HeroUI + Vite**，可实时预览并回写本机 `weasel.yaml`。

- 英文文档：[README.en.md](./README.en.md)
- 许可证：[GPL-3.0](./LICENSE)

---

## 给用户

### 这是什么

无需手改 YAML，用图形界面调整小狼毫皮肤：配色、字体、布局、候选样式，并直接预览效果。

### 获取安装包

从本仓库 **Releases** 下载（或自行打包得到 `release/`）：

| 文件 | 说明 |
|------|------|
| `Weasel-Skin-Studio-x.y.z-setup.exe` | Windows 安装包（推荐） |
| `Weasel-Skin-Studio-x.y.z-portable.exe` | 免安装便携版 |

同目录下的 `SHA256SUMS.txt` 可用于校验完整性。

### 主要功能

- **实时预览**：候选窗、编码区、标签、注释、高亮与阴影即时呈现
- **配色编辑**：覆盖 `preset_color_schemes` 相关字段（窗口 / 预编辑 / 候选 / 注释 / 高亮 / 翻页等）
- **布局与字体**：边框、圆角、间距、字号、标签格式、标记字符等
- **color_format**：支持 `abgr` / `rgba` / `argb` 迁移
- **Studio 模式**：绑定本机 `weasel.yaml` 后，可预览写入、追加/更新配色、写回 `style`、删除方案
- **导入 / 导出**：读取 `weasel.yaml`，导出可粘贴的 YAML 片段
- **内置预设**：Nord、墨池、暗堂、小鹤飞扬、Metro Blue 等

### 如何使用

1. 打开 Weasel Skin Studio
2. 在预设中选一个起点，或点 **导入 YAML** 读入现有 `weasel.yaml`
3. 调整颜色、字体、布局，右侧实时预览
4. 应用到小狼毫：
   - **Studio 模式（推荐）**：顶栏 **打开 weasel.yaml**，选择文件后写回
   - **手动粘贴**：点 **导出 YAML**，粘贴到用户目录的 `weasel.yaml` 对应段
5. 重新部署或重启 Weasel 生效

常见 `weasel.yaml` 路径：

- `%APPDATA%\Rime\weasel.yaml`（小狼毫用户目录）
- 小狼毫安装目录下 `data\weasel.yaml`

> 浏览器/系统安全限制无法自动扫盘，请通过文件选择器指定路径。只读打开时可 **下载当前文件**，再手动覆盖。

---

## 给开发者

### 环境要求

- [Node.js](https://nodejs.org/) 18+（推荐 LTS）
- [Rust](https://www.rust-lang.org/)（`cargo` 在 PATH 中）
- Windows 10/11（打包与桌面运行以 Windows 为目标）

### 快速开始

```bash
npm install
npm run tauri:dev    # 桌面开发（推荐）
# 或仅前端
npm run dev          # http://localhost:5173
```

### 构建与打包

```bash
# 前端产物
npm run build

# Tauri 桌面构建
npm run tauri:build

# 一键打包到 release/（推荐发布用）
build-release.bat
```

`build-release.bat` 会：

1. 检查 Node / npm / Rust
2. 需要时安装依赖
3. 执行 `npm run tauri:build`
4. 将产物重命名并收集到根目录 `release/`：
   - `Weasel-Skin-Studio-<version>-setup.exe`（NSIS 安装包）
   - `Weasel-Skin-Studio-<version>-portable.exe`（便携版主程序）
   - `SHA256SUMS.txt`（校验和）

可选参数：

```bat
build-release.bat --skip-build
```

跳过编译，仅用已有构建结果重新收集命名（调试用）。

版本号读取自根目录 `package.json` 的 `version`。

### 技术栈

| 层 | 技术 |
|----|------|
| 桌面壳 | Tauri 2 |
| 前端 | React 19 |
| UI | [HeroUI](https://heroui.com) 3 + Tailwind CSS 4 |
| 构建 | Vite 6 |
| YAML | js-yaml |
| 系统能力 | `@tauri-apps/plugin-fs` / `plugin-dialog` |

### 目录结构

```
weasel-skin-studio/
├── build-release.bat          # 一键打包脚本
├── package.json
├── vite.config.js
├── index.html
├── src/                       # React 前端
│   ├── App.jsx
│   ├── main.jsx
│   ├── components/            # SkinStudio · LivePreview · ColorField
│   ├── store/                 # skinStore（React Context）
│   ├── data/presets.js        # 内置配色预设
│   ├── styles/index.css       # Tailwind + HeroUI
│   └── utils/                 # color · weaselYaml · weaselFileEdit · fileAccess
└── src-tauri/                 # Tauri / Rust
    ├── tauri.conf.json
    ├── icons/                 # icon.svg 及 PNG / ICO
    └── src/                   # main.rs · lib.rs
```

### 图标

源文件为矢量图标 `src-tauri/icons/icon.svg`（扁平调色板，黑黄主色）。  
派生资源：`icon.png`、`icon.ico`、`32x32.png`、`128x128.png`。  
修改图标后请同步更新这些文件，并在 `src-tauri/tauri.conf.json` 的 `bundle.icon` / `bundle.windows.nsis` 中保持引用。

### 仓库与发布

- `.gitignore` 已忽略 `node_modules/`、`dist`、`src-tauri/target/`、`/release/` 等，适合直接推送到 GitHub
- **不要**把 `release/` 安装包提交进 Git；请用 GitHub Releases 上传 `setup` / `portable` 与 `SHA256SUMS.txt`
- 构建缓存若出现路径迁移导致编译失败，删除 `src-tauri/target/` 后重新打包

### 调试提示

```bash
npm run tauri:dev      # 热更新桌面窗口
npm run preview        # 预览前端生产构建
```

---

## License

GNU General Public License v3.0 — 见 [LICENSE](./LICENSE)。
