# File Preview

一个纯前端的本地文件预览工具，基于 Vue 3 + Vite 构建，能根据不同的文件格式用不同的组件进行特殊语法展示，无需后端服务，所有文件处理均在浏览器中完成。

## 功能特性

### 支持的文件格式

| 类型 | 格式 |
|------|------|
| 文档 | PDF、Word（.docx）、Excel（.xlsx）、PPT（.pptx）、OFD |
| 代码 | JSON、XML、SQL、HTML、YAML、Properties、JS/TS、CSS、Java、Shell |
| 文本 | TXT、CSV、Markdown（.md） |
| 日志 | .log |
| 图片 | PNG、JPG、GIF、SVG、WebP、BMP |
| 音视频 | MP3、WAV、OGG、FLAC、MP4、WebM、MOV 等 |
| 压缩包 | ZIP、JAR、WAR、APK、GZ、TGZ、TAR |

### 核心功能

**文件管理**
- 点击「打开文件」选择本地文件，或直接拖拽文件到页面
- 最近打开的文件自动缓存到 IndexedDB（最多 10 个），刷新页面后自动恢复
- 支持在预览界面通过左右箭头切换文件，键盘 `←` `→` 也可切换

**预览界面**
- 全屏预览模式，点击工具栏按钮或按 `F11` 键切换
- 亮色 / 暗色主题切换，顶部工具栏一键切换
- 内容搜索，点击工具栏搜索按钮或按 `Ctrl+F` 触发，支持关键词高亮、上下翻查

**图片预览**
- 缩放（滚轮 / 按钮 / `+` `-` 键）、旋转、水平翻转、拖拽平移
- 背景底色切换：棋盘格（透明）、深色、白色、浅灰、自定义颜色

**JSON / XML 预览**
- 树形结构渲染，支持节点折叠 / 展开
- 一键全部展开 / 全部收起
- 语法高亮，亮色 / 暗色主题下颜色自动适配

**SQL 预览**
- 按语句块拆分，每条语句可单独折叠
- 类型徽标颜色区分（SELECT / INSERT / UPDATE / DELETE / CREATE 等）
- highlight.js 语法高亮

**Log 预览**
- 虚拟滚动，支持百万行大文件不卡顿
- 自动识别 ERROR / WARN / INFO / DEBUG / TRACE 级别并高亮
- 关键词过滤 + 级别筛选

**Markdown 预览**
- GitHub 风格渲染，支持标题、代码块、表格、引用、图片等

**压缩包预览**
- 左侧文件树浏览压缩包内容
- 右侧直接预览包内的文本、图片、音视频、PDF、Log 等文件

## 快速开始

```bash
npm install
npm run dev
```

构建生产版本：

```bash
npm run build
```

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `←` / `→` | 切换上一个 / 下一个文件 |
| `Esc` | 关闭预览 |
| `F11` | 切换全屏 |
| `Ctrl+F` | 打开搜索 |
| `Enter` / `Shift+Enter` | 搜索下一个 / 上一个 |
| `+` / `-` | 图片放大 / 缩小 |
| `R` | 图片向右旋转 |
| `0` | 图片重置变换 |

## 截图

| 主页（亮色） | 主页（暗色） |
|---|---|
| ![主页亮色](docs/screenshots/home-light.png) | ![主页暗色](docs/screenshots/home-dark.png) |

| JSON 预览 | XML 预览 |
|---|---|
| ![JSON](docs/screenshots/json.png) | ![XML](docs/screenshots/xml.png) |

| SQL 预览 | Log 预览 |
|---|---|
| ![SQL](docs/screenshots/sql.png) | ![Log](docs/screenshots/log.png) |

| 图片预览 | 压缩包预览 |
|---|---|
| ![Image](docs/screenshots/image.png) | ![Archive](docs/screenshots/archive.png) |

| Markdown 预览 | Word 预览 |
|---|---|
| ![Markdown](docs/screenshots/markdown.png) | ![Word](docs/screenshots/word.png) |

## 技术栈

- [Vue 3](https://vuejs.org/) + TypeScript
- [Vite](https://vitejs.dev/)
- [docx-preview](https://github.com/VolodymyrBaydalka/docx-preview) — Word 文档渲染
- [pptx-preview](https://github.com/meshesha/pptx-preview) — PPT 渲染
- [ofd-tools](https://github.com/DLillard0/ofd-tools) / [ofd-view](https://github.com/DLillard0/ofd-view) — OFD 渲染
- [highlight.js](https://highlightjs.org/) — 代码语法高亮
- [marked](https://marked.js.org/) — Markdown 渲染
- [@zip.js/zip.js](https://gildas-lormeau.github.io/zip.js/) — ZIP 解析
- [fflate](https://github.com/101arrowz/fflate) — GZ 解压
- [xlsx](https://sheetjs.com/) — Excel 解析

## 隐私说明

所有文件均在本地浏览器中处理，不会上传到任何服务器。
