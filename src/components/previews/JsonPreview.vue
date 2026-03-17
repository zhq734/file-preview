<template>
  <div class="json-wrap">
    <div class="toolbar">
      <button class="tb-btn" @click="expandAll">全部展开</button>
      <button class="tb-btn" @click="collapseAll">全部收起</button>
    </div>
    <div v-if="error" class="error-tip">{{ error }}</div>
    <div v-else class="json-body">
      <JsonNode :data="parsed" :expand-level="expandLevel" :depth="0" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { readFileAsText } from '../../utils/fileType'
import JsonNode from './JsonNode.vue'

const props = defineProps<{ file: File }>()
const parsed = ref<unknown>(null)
const error = ref('')
const expandLevel = ref(2)   // 控制全部展开/收起的信号

const expandAll  = () => { expandLevel.value = Infinity }
const collapseAll = () => { expandLevel.value = 0 }

onMounted(async () => {
  try {
    const text = await readFileAsText(props.file)
    parsed.value = JSON.parse(text)
  } catch (e) {
    error.value = '解析失败：' + (e as Error).message
  }
})
</script>

<style scoped>
.json-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--bg-base); }
.toolbar { display: flex; gap: 8px; padding: 8px 16px; border-bottom: 1px solid var(--border-muted); flex-shrink: 0; }
.tb-btn { padding: 3px 10px; font-size: 12px; border: 1px solid var(--btn-border); border-radius: 4px; background: var(--btn-bg); cursor: pointer; color: var(--btn-text); }
.tb-btn:hover { border-color: var(--btn-hover-border); color: var(--btn-hover-text); }
.error-tip { padding: 32px; text-align: center; color: #e53e3e; }
.json-body { flex: 1; overflow: auto; padding: 12px 16px; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 13px; line-height: 1.7; }
</style>
