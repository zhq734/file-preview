<template>
  <div class="csv-wrap">
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="table-wrap">
      <table>
        <thead v-if="headers.length">
          <tr>
            <th v-for="(h, i) in headers" :key="i">{{ h }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in rows" :key="ri">
            <td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td>
          </tr>
        </tbody>
      </table>
      <div class="row-count">共 {{ rows.length }} 行</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { readFileAsText } from '../../utils/fileType'

const props = defineProps<{ file: File }>()

const loading = ref(true)
const error = ref('')
const headers = ref<string[]>([])
const rows = ref<string[][]>([])

function parseCSV(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  return lines
    .filter(line => line.trim() !== '')
    .map(line => {
      const result: string[] = []
      let cur = ''
      let inQuote = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
          else inQuote = !inQuote
        } else if (ch === ',' && !inQuote) {
          result.push(cur); cur = ''
        } else {
          cur += ch
        }
      }
      result.push(cur)
      return result
    })
}

onMounted(async () => {
  try {
    const text = await readFileAsText(props.file)
    const all = parseCSV(text)
    if (all.length > 0) {
      headers.value = all[0]
      rows.value = all.slice(1)
    }
  } catch (e) {
    error.value = 'CSV 解析失败：' + (e as Error).message
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.csv-wrap { display: flex; flex-direction: column; width: 100%; height: 100%; overflow: hidden; background: var(--bg-base); }
.table-wrap { flex: 1; overflow: auto; padding: 8px; }
table { border-collapse: collapse; font-size: 13px; width: max-content; }
th {
  border: 1px solid var(--border-muted); padding: 6px 10px;
  background: var(--bg-subtle); color: var(--text-secondary);
  font-weight: 600; white-space: nowrap; position: sticky; top: 0; z-index: 1;
}
td { border: 1px solid var(--border-muted); padding: 4px 10px; white-space: nowrap; color: var(--text-secondary); }
tr:nth-child(even) td { background: var(--bg-subtle); }
.row-count { padding: 6px 8px; font-size: 12px; color: var(--text-faint); }
.loading, .error { padding: 32px; text-align: center; color: var(--text-muted); }
.error { color: #e53e3e; }
</style>
