<template>
  <div class="audio-wrap">
    <div class="audio-info">
      <svg viewBox="0 0 24 24" fill="currentColor" width="64" height="64">
        <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
      </svg>
      <p>{{ file.name }}</p>
    </div>
    <audio :src="url" controls class="audio-player" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { createObjectURL } from '../../utils/fileType'

const props = defineProps<{ file: File }>()
const url = ref('')

onMounted(() => { url.value = createObjectURL(props.file) })
onUnmounted(() => { if (url.value) URL.revokeObjectURL(url.value) })
</script>

<style scoped>
.audio-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 24px;
  color: var(--text-muted);
  background: var(--bg-base);
}
.audio-info { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.audio-player { width: 400px; max-width: 90%; }
</style>
