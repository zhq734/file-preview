<template>
  <div class="app" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop">
    <div v-if="isDragging" class="drag-overlay">
      <div class="drag-hint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
          <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
        </svg>
        <p>松开鼠标即可预览</p>
      </div>
    </div>
    <div class="toolbar">
      <h1 class="title">文件在线预览</h1>
      <button class="theme-btn" @click="toggleTheme" :title="isDark ? '切换亮色' : '切换暗色'">
        <svg v-if="isDark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
      <button class="open-btn" @click="triggerFileInput">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
        </svg>
        打开文件
      </button>
      <button class="url-btn" @click="showUrlDialog = true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        URL 预览
      </button>
      <input ref="fileInputRef" type="file" :accept="ACCEPT" style="display:none" @change="onFileChange" />
    </div>

    <!-- URL 输入弹窗（挂在根节点，避免 toolbar 事件干扰） -->
    <div v-if="showUrlDialog" class="url-mask" @click.self="showUrlDialog = false">
      <div class="url-dialog">
        <p class="url-dialog-title">输入文件 URL</p>
        <input
          ref="urlInputRef"
          v-model="urlInput"
          class="url-input"
          placeholder="https://example.com/file.pdf"
          @keydown.enter="fetchUrl"
          @keydown.escape="showUrlDialog = false"
        />
        <p v-if="urlError" class="url-error">{{ urlError }}</p>
        <div class="url-actions">
          <button type="button" class="url-cancel" @click="showUrlDialog = false">取消</button>
          <button type="button" class="url-confirm" :disabled="urlLoading" @click="fetchUrl">
            {{ urlLoading ? '下载中...' : '预览' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Recent files list -->
    <div class="file-list" v-if="recentFiles.length">
      <p class="list-title">最近打开</p>
      <div
        v-for="(f, i) in recentFiles"
        :key="i"
        class="file-item"
        @click="openFile(f)"
      >
        <span class="file-icon">{{ getIcon(f.name) }}</span>
        <span class="file-item-name">{{ f.name }}</span>
        <span class="file-size">{{ formatSize(f.size) }}</span>
        <button class="remove-btn" @click="removeFile($event, f)" title="从列表移除">✕</button>
      </div>
    </div>

    <!-- Empty state -->
    <div class="empty" v-else>
      <svg viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5" width="80" height="80">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414A1 1 0 0 1 19 9.414V19a2 2 0 0 1-2 2z"/>
      </svg>
      <p>点击「打开文件」选择本地文件进行预览</p>
      <p class="supported-types">支持：PDF · OFD · Word · Excel · PPT · TXT · OUT · MD · CSV · HTML · XML · JSON · YAML · Properties · SQL · Log · Java · Shell · Bat · JS · TS · CSS · Vue · 图片 · 音频 · 视频 · 压缩包</p>
      <p class="drag-tip">或直接将文件拖拽到页面</p>
    </div>

    <FilePreview
      :file="previewFile"
      :visible="previewVisible"
      :files="recentFiles"
      @close="previewVisible = false"
      @navigate="openFile"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import FilePreview from './components/FilePreview.vue'
import { getFileCategory } from './utils/fileType'
import { saveFileToCache, loadCachedFiles, removeCachedFile } from './utils/fileCache'

const ACCEPT = [
  '.pdf',
  '.doc,.docx',
  '.xls,.xlsx',
  '.ppt,.pptx',
  '.txt,.md,.csv,.out,.java,.sh,.bat,.js,.ts,.css,.vue',
  '.ofd',
  '.log',
  '.sql',
  '.yml,.yaml',
  '.properties',
  '.html,.htm',
  '.xml',
  '.json',
  '.png,.jpg,.jpeg,.gif,.svg,.webp,.bmp',
  '.mp3,.wav,.ogg,.flac,.aac',
  '.mp4,.webm,.ogv,.mov',
  '.zip,.rar,.7z,.tar,.gz,.tgz',
  '.class',
  '.emf,.wmf',
  '.heic,.heif',
].join(',')

const isDark = ref(false)
function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : '')
}

const fileInputRef = ref<HTMLInputElement>()
const recentFiles = ref<File[]>([])
const previewFile = ref<File | null>(null)
const previewVisible = ref(false)
const isDragging = ref(false)

// ── URL 预览 ──────────────────────────────────────────
const showUrlDialog = ref(false)
const urlInput     = ref('')
const urlError     = ref('')
const urlLoading   = ref(false)
const urlInputRef  = ref<HTMLInputElement>()

watch(showUrlDialog, (v) => {
  if (v) { urlInput.value = ''; urlError.value = ''; nextTick(() => urlInputRef.value?.focus()) }
})

// Content-Type → 扩展名映射
const MIME_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/zip': 'zip', 'application/x-zip-compressed': 'zip',
  'application/x-tar': 'tar', 'application/gzip': 'gz',
  'application/json': 'json',
  'application/xml': 'xml', 'text/xml': 'xml',
  'text/html': 'html', 'text/css': 'css',
  'text/plain': 'txt', 'text/csv': 'csv',
  'text/x-java-source': 'java',
  'application/javascript': 'js', 'text/javascript': 'js',
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
  'image/svg+xml': 'svg', 'image/webp': 'webp',
  'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav',
  'video/mp4': 'mp4', 'video/webm': 'webm',
}

function guessFilename(url: string, contentType: string, disposition: string): string {
  // 1. 优先从 Content-Disposition 取文件名
  if (disposition) {
    // filename*=UTF-8''xxx（RFC 5987）
    const rfcMatch = disposition.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i)
    if (rfcMatch) return decodeURIComponent(rfcMatch[1].trim().replace(/^"|"$/g, ''))
    // filename="xxx" 或 filename=xxx
    const plainMatch = disposition.match(/filename\s*=\s*"?([^";]+)"?/i)
    if (plainMatch) return decodeURIComponent(plainMatch[1].trim())
  }
  // 2. 从 URL 路径取文件名（有扩展名才用）
  try {
    const pathname = new URL(url).pathname
    const seg = decodeURIComponent(pathname.split('/').pop() ?? '')
    if (seg && seg.includes('.')) return seg
  } catch { /* ignore */ }
  // 3. 从 Content-Type 推断扩展名
  const mime = contentType.split(';')[0].trim()
  const ext  = MIME_EXT[mime] ?? 'bin'
  return `download.${ext}`
}

// 扩展名 → 标准 MIME type，确保 blob URL 能被浏览器正确渲染
const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  json: 'application/json', xml: 'application/xml',
  html: 'text/html', htm: 'text/html', css: 'text/css',
  txt: 'text/plain', csv: 'text/csv', md: 'text/plain',
  zip: 'application/zip', gz: 'application/gzip', tar: 'application/x-tar',
}

function mimeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return EXT_MIME[ext] ?? ''
}

async function fetchUrl() {
  const url = urlInput.value.trim()
  if (!url) { urlError.value = '请输入 URL'; return }
  urlError.value = ''
  urlLoading.value = true
  try {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`)
    const contentType = resp.headers.get('content-type') ?? ''
    const disposition = resp.headers.get('content-disposition') ?? ''
    const blob        = await resp.blob()
    const filename    = guessFilename(url, contentType, disposition)
    // 优先用扩展名推断的 MIME，其次用 blob.type，最后用 Content-Type
    // 避免 MinIO 返回 application/octet-stream 导致浏览器无法渲染
    const mimeType    = mimeFromFilename(filename) || blob.type || contentType.split(';')[0].trim()
    const file        = new File([blob], filename, { type: mimeType })
    addFile(file)
    openFile(file)
    showUrlDialog.value = false
  } catch (e) {
    urlError.value = '下载失败：' + (e as Error).message
  } finally {
    urlLoading.value = false
  }
}

// 启动时从 IndexedDB 恢复缓存
onMounted(async () => {
  recentFiles.value = await loadCachedFiles()
})

const triggerFileInput = () => fileInputRef.value?.click()

const addFile = (file: File) => {
  recentFiles.value = [file, ...recentFiles.value.filter(f => f.name !== file.name)].slice(0, 10)
  saveFileToCache(file) // 后台异步，不阻塞预览
}

const onFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  addFile(file)
  openFile(file)
  ;(e.target as HTMLInputElement).value = ''
}

const openFile = (file: File) => {
  previewFile.value = file
  previewVisible.value = true
}

const removeFile = async (e: MouseEvent, file: File) => {
  e.stopPropagation()
  recentFiles.value = recentFiles.value.filter(f => f !== file)
  await removeCachedFile(file)
}

const onDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}

const onDragLeave = (e: DragEvent) => {
  if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
    isDragging.value = false
  }
}

const onDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  addFile(file)
  openFile(file)
}

const ICON_MAP: Record<string, string> = {
  pdf: '📄', word: '📝', excel: '📊', ppt: '📋',
  text: '📃', csv: '📊', java: '☕', bash: '🖥️', dos: '🖥️', javascript: '📜', typescript: '📘', css: '🎨', vue: '💚', ofd: '📋', markdown: '📋', yaml: '📄', properties: '⚙️', log: '📋', sql: '🗄️',
  html: '🌐', xml: '📑', json: '{ }',
  image: '🖼️', audio: '🎵', video: '🎬', archive: '🗜️', unsupported: '📁',
}

const getIcon = (name: string) => ICON_MAP[getFileCategory(name)] ?? '📁'

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}
</script>

<style scoped>
.app { min-height: 100vh; background: var(--bg-app); display: flex; flex-direction: column; }
.toolbar {
  display: flex; align-items: center; gap: 16px;
  padding: 16px 24px;
  background: var(--bg-toolbar);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.title { margin: 0; font-size: 18px; font-weight: 600; color: var(--text-primary); flex: 1; }
.theme-btn {
  display: flex; align-items: center; justify-content: center;
  padding: 7px 10px;
  background: var(--btn-bg); color: var(--btn-text);
  border: 1px solid var(--btn-border); border-radius: 6px;
  cursor: pointer; transition: background 0.15s;
}
.theme-btn:hover { border-color: var(--btn-hover-border); color: var(--btn-hover-text); }
.open-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px;
  background: #1677ff; color: #fff;
  border: none; border-radius: 6px;
  cursor: pointer; font-size: 14px;
}
.open-btn:hover { background: #0958d9; }
.url-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px;
  background: var(--btn-bg); color: var(--btn-text);
  border: 1px solid var(--btn-border); border-radius: 6px;
  cursor: pointer; font-size: 14px;
}
.url-btn:hover { border-color: #1677ff; color: #1677ff; }

/* URL 弹窗 */
.url-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center; z-index: 3000;
}
.url-dialog {
  background: var(--bg-base); border-radius: 10px;
  padding: 24px; width: 480px; max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  display: flex; flex-direction: column; gap: 12px;
}
.url-dialog-title { margin: 0; font-size: 15px; font-weight: 600; color: var(--text-secondary); }
.url-input {
  width: 100%; padding: 8px 12px; box-sizing: border-box;
  border: 1px solid var(--border); border-radius: 6px;
  font-size: 13px; background: var(--bg-subtle); color: var(--text-secondary);
  outline: none;
}
.url-input:focus { border-color: #1677ff; }
.url-error { margin: 0; font-size: 12px; color: #e53e3e; }
.url-actions { display: flex; justify-content: flex-end; gap: 8px; }
.url-cancel {
  padding: 7px 16px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--btn-bg); color: var(--btn-text); cursor: pointer; font-size: 13px;
}
.url-cancel:hover { border-color: var(--btn-hover-border); }
.url-confirm {
  padding: 7px 16px; border: none; border-radius: 6px;
  background: #1677ff; color: #fff; cursor: pointer; font-size: 13px;
}
.url-confirm:hover:not(:disabled) { background: #0958d9; }
.url-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
.file-list { padding: 24px; max-width: 800px; width: 100%; margin: 0 auto; }
.list-title { font-size: 13px; color: var(--text-faint); margin: 0 0 12px; }
.file-item {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px;
  background: var(--bg-base); border-radius: 8px;
  margin-bottom: 8px; cursor: pointer;
  border: 1px solid var(--border-muted);
  transition: box-shadow 0.15s;
}
.file-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-color: #d0e4ff; }
.file-icon { font-size: 20px; flex-shrink: 0; }
.file-item-name { flex: 1; font-size: 14px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { font-size: 12px; color: var(--text-placeholder); flex-shrink: 0; }
.remove-btn {
  background: none; border: none; cursor: pointer;
  color: var(--text-placeholder); font-size: 14px; padding: 2px 6px;
  border-radius: 4px; line-height: 1; flex-shrink: 0;
  opacity: 0; transition: opacity 0.15s;
}
.file-item:hover .remove-btn { opacity: 1; }
.remove-btn:hover { background: #fee2e2; color: #e53e3e; }
.empty {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 12px; color: var(--text-faint);
}
.supported-types { font-size: 13px; color: var(--text-placeholder); }
.drag-tip { font-size: 13px; color: var(--text-placeholder); margin-top: -4px; }
.drag-overlay {
  position: fixed; inset: 0;
  background: rgba(22, 119, 255, 0.12);
  border: 3px dashed #1677ff;
  z-index: 2000;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none;
}
.drag-hint {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  color: #1677ff; font-size: 18px; font-weight: 500;
}
.drag-hint p { margin: 0; }
</style>
