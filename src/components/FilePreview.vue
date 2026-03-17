<template>
  <div class="preview-modal" v-if="visible" @click.self="close" @keydown.left.prevent="prev" @keydown.right.prevent="next">
    <div class="preview-dialog" :class="{ fullscreen: isFullscreen }">
      <!-- Header -->
      <div class="preview-header">
        <!-- 上一个 -->
        <button class="nav-btn" :disabled="currentIndex <= 0" @click="prev" title="上一个 (←)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span class="file-name" :title="file?.name">{{ file?.name }}</span>
        <span class="file-index" v-if="files.length > 1">{{ currentIndex + 1 }} / {{ files.length }}</span>
        <!-- 下一个 -->
        <button class="nav-btn" :disabled="currentIndex >= files.length - 1" @click="next" title="下一个 (→)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <button class="nav-btn" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏 (F)' : '全屏预览 (F)'">
          <svg v-if="!isFullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
        </button>
        <button class="close-btn" @click="close" aria-label="关闭">✕</button>
      </div>
      <!-- Body -->
      <div class="preview-body">
        <component :is="previewComponent" v-if="previewComponent && file" :file="file" :key="file.name + file.size" />
        <div v-else class="unsupported-tip">
          <p>不支持预览该文件类型</p>
          <p class="hint">{{ file?.name }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onBeforeUnmount, ref } from 'vue'
import { getFileCategory } from '../utils/fileType'

const props = defineProps<{
  file: File | null
  visible: boolean
  files: File[]        // 完整列表，用于切换
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'navigate', file: File): void
}>()

const close = () => emit('close')

const isFullscreen = ref(false)
const toggleFullscreen = () => { isFullscreen.value = !isFullscreen.value }

const currentIndex = computed(() =>
  props.file ? props.files.findIndex(f => f === props.file) : -1
)

const prev = () => {
  if (currentIndex.value > 0) emit('navigate', props.files[currentIndex.value - 1])
}
const next = () => {
  if (currentIndex.value < props.files.length - 1) emit('navigate', props.files[currentIndex.value + 1])
}

// 键盘左右箭头切换
function onKeydown(e: KeyboardEvent) {
  if (!props.visible) return
  if (e.key === 'ArrowLeft') prev()
  if (e.key === 'ArrowRight') next()
  if (e.key === 'Escape') close()
  if (e.key === 'f' || e.key === 'F') toggleFullscreen()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

const COMPONENT_MAP: Record<string, ReturnType<typeof defineAsyncComponent>> = {
  pdf:        defineAsyncComponent(() => import('./previews/PdfPreview.vue')),
  word:       defineAsyncComponent(() => import('./previews/WordPreview.vue')),
  excel:      defineAsyncComponent(() => import('./previews/ExcelPreview.vue')),
  ppt:        defineAsyncComponent(() => import('./previews/PptPreview.vue')),
  text:       defineAsyncComponent(() => import('./previews/TextPreview.vue')),
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
}

const previewComponent = computed(() => {
  if (!props.file) return null
  return COMPONENT_MAP[getFileCategory(props.file.name)] ?? null
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
.preview-dialog.fullscreen {
  width: 100vw; height: 100vh;
  border-radius: 0;
  box-shadow: none;
}
.preview-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--header-bg);
  flex-shrink: 0;
}
.file-name {
  flex: 1;
  font-size: 15px; font-weight: 500; color: var(--text-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.file-index {
  font-size: 12px; color: var(--text-faint); white-space: nowrap; flex-shrink: 0;
}
.nav-btn {
  background: none; border: 1px solid var(--border); cursor: pointer;
  padding: 4px 6px; border-radius: 4px; color: var(--text-muted);
  display: flex; align-items: center; flex-shrink: 0;
  transition: background 0.15s;
}
.nav-btn:hover:not(:disabled) { background: var(--bg-muted); color: var(--text-secondary); border-color: var(--btn-border); }
.nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.close-btn {
  background: none; border: none; cursor: pointer;
  font-size: 18px; color: var(--text-faint); padding: 4px 8px;
  border-radius: 4px; line-height: 1; flex-shrink: 0;
}
.close-btn:hover { background: var(--bg-muted); color: var(--text-secondary); }
.preview-body { flex: 1; overflow: hidden; }
.unsupported-tip {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; height: 100%; color: var(--text-faint); gap: 8px;
}
.hint { font-size: 13px; color: var(--text-placeholder); }
</style>
