<template>
  <div class="word-wrap">
    <div v-if="loading" class="status">加载中...</div>
    <div v-else-if="error" class="status error">{{ error }}</div>

    <div v-else-if="isLegacyDoc" class="legacy-tip">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="56" height="56">
        <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      </svg>
      <p class="tip-title">.doc 格式无法在浏览器中预览</p>
      <p class="tip-desc">请用 Microsoft Word 或 WPS 将文件另存为 <strong>.docx</strong> 格式后重新打开。</p>
    </div>

    <div v-else class="page-wrap">
      <div ref="containerRef" class="docx-container" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { renderAsync } from 'docx-preview'

const props = defineProps<{ file: File }>()

const loading = ref(true)
const error = ref('')
const containerRef = ref<HTMLElement | null>(null)
const buffer = ref<ArrayBuffer | null>(null)

const isLegacyDoc = computed(() => props.file.name.toLowerCase().endsWith('.doc'))

onMounted(async () => {
  if (isLegacyDoc.value) {
    loading.value = false
    return
  }
  try {
    buffer.value = await props.file.arrayBuffer()
  } catch (e) {
    error.value = '文件读取失败：' + (e as Error).message
  } finally {
    loading.value = false
    await nextTick()
  }
  if (!buffer.value || !containerRef.value) return
  try {
    await renderAsync(buffer.value, containerRef.value, undefined, {
      className: 'docx-render',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      useBase64URL: true,
      renderChanges: false,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
    })
  } catch (e) {
    error.value = '文档解析失败：' + (e as Error).message
  }
})
</script>

<style scoped>
.word-wrap {
  width: 100%;
  height: 100%;
  overflow: auto;
  background: var(--bg-muted);
}
.status {
  padding: 32px;
  text-align: center;
  color: var(--text-muted);
}
.status.error { color: #e53e3e; }
.legacy-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--text-faint);
  padding: 32px;
  text-align: center;
}
.tip-title { font-size: 15px; font-weight: 500; color: var(--text-muted); margin: 0; }
.tip-desc { font-size: 13px; color: var(--text-placeholder); margin: 0; line-height: 1.6; }
.tip-desc strong { color: #1677ff; }
.page-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0 40px;
  min-height: 100%;
}
.docx-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>

<style>
/* docx-preview 生成的页面样式覆盖 */
.docx-render .docx-wrapper {
  background: var(--bg-muted) !important;
  padding: 24px 0 !important;
}
.docx-render section.docx {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15) !important;
  margin-bottom: 16px !important;
}
/* 修复 autofit 表格列错位问题 */
.docx-render table {
  table-layout: fixed !important;
  word-break: break-word !important;
  overflow-wrap: break-word !important;
}
.docx-render td,
.docx-render th {
  overflow: hidden !important;
  word-break: break-word !important;
  overflow-wrap: break-word !important;
}
</style>
