<template>
  <iframe :src="url" class="preview-frame" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{ file: File }>()
const url = ref('')

onMounted(async () => {
  // 无论原始 File 的 type 是什么，强制用 application/pdf 构造 blob URL
  // 避免 MinIO 等返回 application/octet-stream 导致 iframe 触发下载
  const buf = await props.file.arrayBuffer()
  const blob = new Blob([buf], { type: 'application/pdf' })
  url.value = URL.createObjectURL(blob)
})
onUnmounted(() => { if (url.value) URL.revokeObjectURL(url.value) })
</script>

<style scoped>
.preview-frame { width: 100%; height: 100%; border: none; }
</style>
