<template>
  <div class="heic-wrap">
    <div v-if="loading" class="status">转换中...</div>
    <div v-else-if="error" class="status error">{{ error }}</div>
    <img v-else :src="imgUrl" class="heic-img" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import heic2any from 'heic2any'

const props = defineProps<{ file: File }>()
const loading = ref(true)
const error = ref('')
const imgUrl = ref('')

onMounted(async () => {
  try {
    const blob = await heic2any({ blob: props.file, toType: 'image/png' }) as Blob
    imgUrl.value = URL.createObjectURL(blob)
  } catch (e) {
    error.value = '转换失败：' + ((e as Error).message ?? String(e))
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (imgUrl.value) URL.revokeObjectURL(imgUrl.value)
})
</script>

<style scoped>
.heic-wrap { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: var(--bg-muted); overflow: auto; }
.heic-img { max-width: 100%; max-height: 100%; object-fit: contain; }
.status { padding: 32px; text-align: center; color: var(--text-muted); }
.status.error { color: #e53e3e; }
</style>
