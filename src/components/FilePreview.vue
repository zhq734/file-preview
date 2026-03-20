<template>
  <div class="preview-modal" v-if="visible" @click.self="close">
    <div class="preview-dialog" :class="{ fullscreen: isFullscreen }">
      <!-- Header -->
      <div class="preview-header">
        <button class="nav-btn" :disabled="currentIndex <= 0" @click="prev" title="上一个 (←)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span class="file-name" :title="file?.name">{{ file?.name }}</span>
        <span class="file-index" v-if="files.length > 1">{{ currentIndex + 1 }} / {{ files.length }}</span>
        <button class="nav-btn" :disabled="currentIndex >= files.length - 1" @click="next" title="下一个 (→)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <!-- 搜索按钮 -->
        <button v-if="searchable" class="nav-btn" @click="toggleSearch" :title="searchVisible ? '关闭搜索 (Ctrl+F)' : '搜索 (Ctrl+F)'" :class="{ active: searchVisible }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        </button>
        <!-- 下载按钮 -->
        <button class="nav-btn" @click="downloadFile" title="下载文件">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="nav-btn" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏 (F11)' : '全屏预览 (F11)'">
          <svg v-if="!isFullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
        </button>
        <button class="close-btn" @click="close" aria-label="关闭">✕</button>
      </div>

      <!-- 搜索栏 -->
      <div class="search-bar" v-if="searchVisible && searchable">
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          class="search-input"
          placeholder="搜索..."
          @input="doSearch"
          @keydown.enter.prevent="stepMatch(1)"
          @keydown.shift.enter.prevent="stepMatch(-1)"
          @keydown.escape.prevent="closeSearch"
        />
        <span class="search-count" v-if="searchQuery">
          {{ matchTotal > 0 ? `${matchIndex + 1} / ${matchTotal}` : '无结果' }}
        </span>
        <button class="search-nav-btn" :disabled="matchTotal === 0" @click="stepMatch(-1)" title="上一个 (Shift+Enter)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M18 15l-6-6-6 6"/></svg>
        </button>
        <button class="search-nav-btn" :disabled="matchTotal === 0" @click="stepMatch(1)" title="下一个 (Enter)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <button class="search-close-btn" @click="closeSearch">✕</button>
      </div>

      <!-- Body -->
      <div class="preview-body" ref="previewBodyRef">
        <component :is="previewComponent" v-if="previewComponent && file" :file="file" :language="fileLanguage" :key="file.name + file.size" />
        <div v-else class="unsupported-tip">
          <p>不支持预览该文件类型</p>
          <p class="hint">{{ file?.name }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onBeforeUnmount, ref, nextTick, watch } from 'vue'
import { getFileCategory } from '../utils/fileType'

const props = defineProps<{
  file: File | null
  visible: boolean
  files: File[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'navigate', file: File): void
}>()

const close = () => emit('close')
const isFullscreen = ref(false)
const toggleFullscreen = () => { isFullscreen.value = !isFullscreen.value }

function downloadFile() {
  if (!props.file) return
  const url = URL.createObjectURL(props.file)
  const a = document.createElement('a')
  a.href = url; a.download = props.file.name
  a.click()
  URL.revokeObjectURL(url)
}

const currentIndex = computed(() =>
  props.file ? props.files.findIndex(f => f === props.file) : -1
)
const prev = () => { if (currentIndex.value > 0) emit('navigate', props.files[currentIndex.value - 1]) }
const next = () => { if (currentIndex.value < props.files.length - 1) emit('navigate', props.files[currentIndex.value + 1]) }

// ── 搜索 ──────────────────────────────────────────────
const UNSEARCHABLE = new Set(['image', 'audio', 'video', 'pdf', 'ppt'])
const searchable = computed(() => {
  if (!props.file) return false
  return !UNSEARCHABLE.has(getFileCategory(props.file.name))
})

const searchVisible = ref(false)
const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const previewBodyRef = ref<HTMLElement | null>(null)
const matchTotal = ref(0)
const matchIndex = ref(0)

const MARK_CLASS = 'search-highlight'
const MARK_ACTIVE = 'search-highlight-active'

// 搜索前对每个被修改的容器元素保存原始 HTML 快照，清除时直接还原，避免逐节点 DOM 操作卡顿
const snapshots = new Map<Element, string>()

function clearMarks() {
  // 用快照还原，O(n_containers) 次 innerHTML 赋值，远快于逐节点 replaceChild+normalize
  snapshots.forEach((html, el) => { el.innerHTML = html })
  snapshots.clear()
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
// 记录当前批次 ID，用于取消过期批次
let batchId = 0

function doSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(_execSearch, 200)
}

function _execSearch() {
  // 取消上一次未完成的分批任务
  batchId++
  clearMarks()
  matchTotal.value = 0
  matchIndex.value = 0
  const kw = searchQuery.value.trim()
  if (!kw || !previewBodyRef.value) return

  const marks: HTMLElement[] = []
  const walker = document.createTreeWalker(
    previewBodyRef.value,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const el = node.parentElement
        if (!el) return NodeFilter.FILTER_REJECT
        const tag = el.tagName.toLowerCase()
        if (['script', 'style', 'input', 'textarea'].includes(tag)) return NodeFilter.FILTER_REJECT
        if (el.classList.contains(MARK_CLASS)) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      }
    }
  )

  const kwLower = kw.toLowerCase()
  const nodes: Text[] = []
  let n: Node | null
  while ((n = walker.nextNode())) nodes.push(n as Text)

  const BATCH = 200
  let i = 0
  const thisBatch = batchId

  function processBatch() {
    // 如果已被新的搜索取代，直接退出
    if (thisBatch !== batchId) return

    const end = Math.min(i + BATCH, nodes.length)
    for (; i < end; i++) {
      const textNode = nodes[i]
      // 节点可能已被前面的批次操作移除
      if (!textNode.parentNode) continue
      const text = textNode.textContent ?? ''
      const lower = text.toLowerCase()
      let pos = 0
      let idx = lower.indexOf(kwLower, pos)
      if (idx === -1) continue

      // 保存容器快照（仅首次）
      const container = textNode.parentElement!
      if (!snapshots.has(container)) {
        snapshots.set(container, container.innerHTML)
      }

      const frag = document.createDocumentFragment()
      while (idx !== -1) {
        if (idx > pos) frag.appendChild(document.createTextNode(text.slice(pos, idx)))
        const mark = document.createElement('mark')
        mark.className = MARK_CLASS
        mark.textContent = text.slice(idx, idx + kw.length)
        frag.appendChild(mark)
        marks.push(mark)
        pos = idx + kw.length
        idx = lower.indexOf(kwLower, pos)
      }
      if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)))
      textNode.parentNode.replaceChild(frag, textNode)
    }

    if (i < nodes.length) {
      setTimeout(processBatch, 0)
    } else {
      matchTotal.value = marks.length
      if (marks.length > 0) activateMark(marks, 0)
    }
  }

  processBatch()
}

function activateMark(marks: HTMLElement[], idx: number) {
  marks.forEach(m => m.classList.remove(MARK_ACTIVE))
  marks[idx]?.classList.add(MARK_ACTIVE)
  marks[idx]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function stepMatch(dir: 1 | -1) {
  if (matchTotal.value === 0) return
  const marks = previewBodyRef.value?.querySelectorAll<HTMLElement>(`mark.${MARK_CLASS}`)
  if (!marks?.length) return
  matchIndex.value = (matchIndex.value + dir + marks.length) % marks.length
  activateMark(Array.from(marks), matchIndex.value)
}

function toggleSearch() {
  searchVisible.value = !searchVisible.value
  if (searchVisible.value) {
    nextTick(() => searchInputRef.value?.focus())
  } else {
    closeSearch()
  }
}

function closeSearch() {
  if (searchTimer) { clearTimeout(searchTimer); searchTimer = null }
  batchId++ // 取消任何进行中的分批任务
  searchVisible.value = false
  searchQuery.value = ''
  clearMarks()
  matchTotal.value = 0
  matchIndex.value = 0
}

// 切换文件或重新打开预览时，重新执行搜索
watch(() => props.file, async () => {
  batchId++
  clearMarks()
  matchTotal.value = 0
  matchIndex.value = 0
  if (searchQuery.value.trim()) {
    await nextTick()
    setTimeout(doSearch, 300)
  }
})

watch(() => props.visible, async (v) => {
  if (v && searchQuery.value.trim()) {
    await nextTick()
    setTimeout(doSearch, 300)
  }
})

// ── 键盘 ──────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (!props.visible) return
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    if (searchable.value) { e.preventDefault(); searchVisible.value = true; nextTick(() => searchInputRef.value?.focus()) }
    return
  }
  if (searchVisible.value) return  // 搜索模式下不触发其他快捷键
  if (e.key === 'ArrowLeft') prev()
  if (e.key === 'ArrowRight') next()
  if (e.key === 'Escape') close()
  if (e.key === 'F11') { e.preventDefault(); toggleFullscreen() }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (searchTimer) clearTimeout(searchTimer)
})

// ── 预览组件映射 ──────────────────────────────────────
const COMPONENT_MAP: Record<string, ReturnType<typeof defineAsyncComponent>> = {
  pdf:        defineAsyncComponent(() => import('./previews/PdfPreview.vue')),
  word:       defineAsyncComponent(() => import('./previews/WordPreview.vue')),
  excel:      defineAsyncComponent(() => import('./previews/ExcelPreview.vue')),
  ppt:        defineAsyncComponent(() => import('./previews/PptPreview.vue')),
  text:       defineAsyncComponent(() => import('./previews/TextPreview.vue')),
  csv:        defineAsyncComponent(() => import('./previews/CsvPreview.vue')),
  java:       defineAsyncComponent(() => import('./previews/CodePreview.vue')),
  bash:       defineAsyncComponent(() => import('./previews/CodePreview.vue')),
  dos:        defineAsyncComponent(() => import('./previews/CodePreview.vue')),
  javascript: defineAsyncComponent(() => import('./previews/CodePreview.vue')),
  typescript: defineAsyncComponent(() => import('./previews/CodePreview.vue')),
  css:        defineAsyncComponent(() => import('./previews/CodePreview.vue')),
  vue:        defineAsyncComponent(() => import('./previews/CodePreview.vue')),
  ofd:        defineAsyncComponent(() => import('./previews/OfdPreview.vue')),
  markdown:   defineAsyncComponent(() => import('./previews/MarkdownPreview.vue')),
  yaml:       defineAsyncComponent(() => import('./previews/YamlPreview.vue')),
  properties: defineAsyncComponent(() => import('./previews/PropertiesPreview.vue')),
  log:        defineAsyncComponent(() => import('./previews/LogPreview.vue')),
  sql:        defineAsyncComponent(() => import('./previews/SqlPreview.vue')),
  html:       defineAsyncComponent(() => import('./previews/HtmlPreview.vue')),
  xml:        defineAsyncComponent(() => import('./previews/XmlPreview.vue')),
  json:       defineAsyncComponent(() => import('./previews/JsonPreview.vue')),
  image:      defineAsyncComponent(() => import('./previews/ImagePreview.vue')),
  audio:      defineAsyncComponent(() => import('./previews/AudioPreview.vue')),
  video:      defineAsyncComponent(() => import('./previews/VideoPreview.vue')),
  archive:    defineAsyncComponent(() => import('./previews/ArchivePreview.vue')),
  class:      defineAsyncComponent(() => import('./previews/ClassPreview.vue')),
  metafile:   defineAsyncComponent(() => import('./previews/MetafilePreview.vue')),
  heic:       defineAsyncComponent(() => import('./previews/HeicPreview.vue')),
}

const previewComponent = computed(() => {
  if (!props.file) return null
  return COMPONENT_MAP[getFileCategory(props.file.name)] ?? null
})

const LANGUAGE_MAP: Record<string, string> = {
  java:       'java',
  bash:       'bash',
  dos:        'dos',
  javascript: 'javascript',
  typescript: 'typescript',
  css:        'css',
  vue:        'xml',  // hljs 用 xml 渲染 vue 模板
}
const fileLanguage = computed(() => {
  if (!props.file) return ''
  return LANGUAGE_MAP[getFileCategory(props.file.name)] ?? ''
})
</script>

<style scoped>
.preview-modal {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex; justify-content: center; align-items: center;
  z-index: 1000;
}
.preview-dialog {
  background: var(--bg-base);
  border-radius: 8px;
  width: 90vw; height: 90vh;
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px var(--shadow);
  transition: all 0.2s ease;
}
.preview-dialog.fullscreen { width: 100vw; height: 100vh; border-radius: 0; box-shadow: none; }

.preview-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--header-bg);
  flex-shrink: 0;
}
.file-name {
  flex: 1; font-size: 15px; font-weight: 500; color: var(--text-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.file-index { font-size: 12px; color: var(--text-faint); white-space: nowrap; flex-shrink: 0; }
.nav-btn {
  background: none; border: 1px solid var(--border); cursor: pointer;
  padding: 4px 6px; border-radius: 4px; color: var(--text-muted);
  display: flex; align-items: center; flex-shrink: 0;
  transition: background 0.15s;
}
.nav-btn:hover:not(:disabled) { background: var(--bg-muted); color: var(--text-secondary); border-color: var(--btn-border); }
.nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.nav-btn.active { background: var(--bg-muted); color: #1677ff; border-color: #1677ff; }
.close-btn {
  background: none; border: none; cursor: pointer;
  font-size: 18px; color: var(--text-faint); padding: 4px 8px;
  border-radius: 4px; line-height: 1; flex-shrink: 0;
}
.close-btn:hover { background: var(--bg-muted); color: var(--text-secondary); }

/* 搜索栏 */
.search-bar {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--header-bg);
  flex-shrink: 0;
}
.search-input {
  flex: 1; max-width: 320px;
  padding: 4px 10px; border: 1px solid var(--border); border-radius: 4px;
  font-size: 13px; background: var(--bg-subtle); color: var(--text-secondary);
  outline: none;
}
.search-input:focus { border-color: #1677ff; }
.search-count { font-size: 12px; color: var(--text-faint); white-space: nowrap; min-width: 60px; }
.search-nav-btn {
  background: none; border: 1px solid var(--border); cursor: pointer;
  padding: 3px 6px; border-radius: 4px; color: var(--text-muted);
  display: flex; align-items: center;
}
.search-nav-btn:hover:not(:disabled) { background: var(--bg-muted); color: var(--text-secondary); }
.search-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.search-close-btn {
  background: none; border: none; cursor: pointer;
  font-size: 14px; color: var(--text-faint); padding: 2px 6px;
  border-radius: 4px; line-height: 1;
}
.search-close-btn:hover { background: var(--bg-muted); color: var(--text-secondary); }

.preview-body { flex: 1; overflow: hidden; }
.unsupported-tip {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; height: 100%; color: var(--text-faint); gap: 8px;
}
.hint { font-size: 13px; color: var(--text-placeholder); }
</style>

<style>
/* 搜索高亮（全局，作用于子组件内容） */
mark.search-highlight {
  background: #ffe58f;
  color: #000;
  border-radius: 2px;
  padding: 0;
}
mark.search-highlight-active {
  background: #ff9f1a;
  color: #000;
  outline: 2px solid #ff9f1a;
}

[data-theme="dark"] mark.search-highlight {
  background: #7c6200;
  color: #fff;
}
[data-theme="dark"] mark.search-highlight-active {
  background: #e6a817;
  color: #000;
  outline-color: #e6a817;
}
</style>
