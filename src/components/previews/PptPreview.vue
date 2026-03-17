<template>
  <div class="ppt-wrap">
    <div v-if="loading" class="status">加载中...</div>
    <div v-if="error" class="status error">{{ error }}</div>

    <div v-if="isLegacyPpt && !loading" class="legacy-tip">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="56" height="56">
        <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      </svg>
      <p class="tip-title">.ppt 格式无法在浏览器中预览</p>
      <p class="tip-desc">请用 Microsoft PowerPoint 或 WPS 将文件另存为 <strong>.pptx</strong> 格式后重新打开。</p>
    </div>

    <div v-show="!loading && !error && !isLegacyPpt" ref="containerRef" class="pptx-container" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{ file: File }>()

const containerRef = ref<HTMLDivElement>()
const loading = ref(true)
const error = ref('')
let previewInstance: any = null

const isLegacyPpt = computed(() => props.file.name.toLowerCase().endsWith('.ppt'))

onMounted(async () => {
  if (isLegacyPpt.value) {
    loading.value = false
    return
  }
  try {
    const buffer = await props.file.arrayBuffer()
    const { init } = await import('pptx-preview')
    const width = containerRef.value!.clientWidth || 800
    previewInstance = init(containerRef.value!, {
      width,
      mode: 'scroll',  // scroll = 所有幻灯片垂直排列
    })
    await previewInstance.preview(buffer)
  } catch (e) {
    error.value = '演示文稿解析失败：' + (e as Error).message
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  previewInstance?.destroy?.()
})
</script>

<style scoped>
.ppt-wrap {
  width: 100%;
  height: 100%;
  overflow: auto;
  background: #404040;
}
.status {
  padding: 32px;
  text-align: center;
  color: #ccc;
}
.status.error { color: #fc8181; }
.legacy-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: #999;
  padding: 32px;
  text-align: center;
}
.tip-title { font-size: 15px; font-weight: 500; color: #666; margin: 0; }
.tip-desc { font-size: 13px; color: #aaa; margin: 0; line-height: 1.6; }
.tip-desc strong { color: #1677ff; }
.pptx-container {
  width: 100%;
  min-height: 100%;
  padding: 20px 0;
  box-sizing: border-box;
}
</style>
