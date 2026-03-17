<template>
  <iframe ref="iframeRef" class="preview-frame" sandbox="allow-same-origin allow-scripts" />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { readFileAsText } from '../../utils/fileType'

const props = defineProps<{ file: File }>()
const iframeRef = ref<HTMLIFrameElement>()

onMounted(async () => {
  const html = await readFileAsText(props.file)
  const doc = iframeRef.value?.contentDocument
  if (doc) {
    doc.open()
    doc.write(html)
    doc.close()
  }
})
</script>

<style scoped>
.preview-frame { width: 100%; height: 100%; border: none; }
</style>
