<template>
  <div class="text-wrap">
    <pre class="text-content">{{ content }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { readFileAsText } from '../../utils/fileType'

const props = defineProps<{ file: File }>()
const content = ref('')

onMounted(async () => {
  content.value = await readFileAsText(props.file)
})
</script>

<style scoped>
.text-wrap { width: 100%; height: 100%; overflow: auto; padding: 16px; box-sizing: border-box; background: var(--bg-base); }
.text-content {
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-secondary);
}
</style>
