<template>
  <div class="video-wrap">
    <video :src="url" controls class="video-player" />
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
.video-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  background: #000;
}
.video-player { max-width: 100%; max-height: 100%; }
</style>
