<template>
  <div class="log-file-wrap">
    <div v-if="loading" class="status">加载中...</div>
    <LogViewer v-else :text="text" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { readFileAsText } from '../../utils/fileType'
import LogViewer from './LogViewer.vue'

const props = defineProps<{ file: File }>()
const loading = ref(true)
const text = ref('')

onMounted(async () => {
  text.value = await readFileAsText(props.file)
  loading.value = false
})
</script>

<style scoped>
.log-file-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; }
.status { padding: 32px; text-align: center; color: #666; }
</style>
