<template>
  <iframe :src="url" class="preview-frame" />
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
.preview-frame { width: 100%; height: 100%; border: none; }
</style>
