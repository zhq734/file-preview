<template>
  <div class="excel-wrap">
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <template v-else>
      <!-- Sheet tabs -->
      <div class="sheet-tabs">
        <button
          v-for="name in sheetNames"
          :key="name"
          :class="['tab', { active: name === activeSheet }]"
          @click="activeSheet = name"
        >{{ name }}</button>
      </div>
      <!-- Table -->
      <div class="table-wrap">
        <table>
          <tbody>
            <tr v-for="(row, ri) in currentData" :key="ri">
              <td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { readFileAsArrayBuffer } from '../../utils/fileType'

const props = defineProps<{ file: File }>()
const loading = ref(true)
const error = ref('')
const sheetNames = ref<string[]>([])
const activeSheet = ref('')
const sheetsData = ref<Record<string, string[][]>>({})

const currentData = computed(() => sheetsData.value[activeSheet.value] ?? [])

onMounted(async () => {
  try {
    const buffer = await readFileAsArrayBuffer(props.file)
    const XLSX = await import('xlsx')
    const wb = XLSX.read(buffer, { type: 'array' })
    sheetNames.value = wb.SheetNames
    activeSheet.value = wb.SheetNames[0]
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name]
      sheetsData.value[name] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
    }
  } catch (e) {
    error.value = '表格解析失败：' + (e as Error).message
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.excel-wrap { display: flex; flex-direction: column; width: 100%; height: 100%; overflow: hidden; background: var(--bg-base); }
.sheet-tabs { display: flex; gap: 4px; padding: 8px 12px; background: var(--bg-subtle); border-bottom: 1px solid var(--border); flex-shrink: 0; }
.tab {
  padding: 4px 12px; border: 1px solid var(--btn-border); background: var(--btn-bg);
  cursor: pointer; border-radius: 4px 4px 0 0; font-size: 13px; color: var(--btn-text);
}
.tab.active { background: #1677ff; color: #fff; border-color: #1677ff; }
.table-wrap { flex: 1; overflow: auto; padding: 8px; }
table { border-collapse: collapse; font-size: 13px; }
td { border: 1px solid var(--border-muted); padding: 4px 8px; white-space: nowrap; min-width: 60px; color: var(--text-secondary); }
.loading, .error { padding: 32px; text-align: center; color: var(--text-muted); }
.error { color: #e53e3e; }
</style>
