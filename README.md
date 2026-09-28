# Weasel Skin Studio

小狼毫（Weasel）输入法可视化皮肤调整工具，基于 **Vue 3 + Element Plus + Vite**。

## 功能

- **实时预览**：候选窗、编码区、标签、注释、高亮与阴影即时呈现
- **配色编辑**：完整覆盖 `preset_color_schemes` 字段（窗口 / 预编辑 / 候选 / 注释 / 高亮 / 翻页）
- **布局与字体**：边框、圆角、间距、字号、标签格式、标记字符等
- **color_format**：支持 `abgr` / `rgba` / `argb` 互相迁移
- **Studio 模式**：选择本机 `weasel.yaml` 存放位置后，可修改、预览、追加配色方案
- **导入 / 导出**：读取 `weasel.yaml`，导出可粘贴的 YAML 片段
- **内置预设**：Nord、墨池、暗堂、小鹤飞扬、Metro Blue 等

## Studio 模式（绑定本机 weasel.yaml）

1. 点击顶栏 **打开 weasel.yaml**，选择文件位置（Chrome / Edge 可读写）
2. 侧栏显示路径、可写状态、文件内配色数量
3. 调整配色后：
   - **预览写入**：查看将写入的完整 YAML（追加/替换，保留其它内容与注释）
   - **追加 / 更新当前配色**：把当前方案写入 `preset_color_schemes`
   - **写回 style**：更新字号、布局等 `style` 键
   - **从文件删除**：移除当前方案块
4. 只读打开时可 **下载当前文件**，再手动覆盖到用户目录

常见路径：

- `%APPDATA%\Rime\weasel.yaml`（小狼毫用户目录）
- 小狼毫安装目录下 `data\weasel.yaml`

浏览器安全限制无法自动扫描磁盘路径，请用文件选择器指定。

## 启动

```bash
cd weasel-skin-studio
npm install
npm run dev
```

浏览器打开终端提示的本地地址（默认 http://localhost:5173）。

## 构建

```bash
npm run build
npm run preview
```

## 导入到 Weasel

1. 在工具中调整好皮肤
2. 点击 **导出 YAML**（或「复制全部」）
3. 将内容粘贴到小狼毫用户目录的 `weasel.yaml`（替换 `style` / `preset_color_schemes` 对应段）
4. 重新部署或重启 Weasel

也可使用顶栏 **导入 YAML** 直接读取现有 `weasel.yaml` 继续微调。

## 目录结构

```
weasel-skin-studio/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.js
    ├── App.vue
    ├── components/     # SkinStudio / LivePreview / ColorField
    ├── composables/    # useSkinStore
    ├── data/presets.js # 内置配色
    ├── styles/main.css
    └── utils/          # color.js · weaselYaml.js
```
