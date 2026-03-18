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
          @click="switchSheet(name)"
        >{{ name }}</button>
      </div>
      <!-- Filter bar -->
      <div class="filter-bar" v-if="headers.length">
        <input
          v-model="filterText"
          class="filter-input"
          placeholder="输入关键词过滤..."
        />
        <span class="row-count">{{ filteredRows.length }} / {{ dataRows.length }} 行</span>
        <button v-if="filterText || sortCol !== null" class="clear-btn" @click="clearFilter">重置</button>
      </div>
      <!-- Table -->
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th
                v-for="(h, ci) in headers"
                :key="ci"
                @click="toggleSort(ci)"
                :class="{ sortable: true, asc: sortCol === ci && sortDir === 'asc', desc: sortCol === ci && sortDir === 'desc' }"
              >
                <span>{{ h }}</span>
                <span class="sort-icon">
                  <svg viewBox="0 0 10 14" width="10" height="14" fill="currentColor">
                    <path :opacity="sortCol === ci && sortDir === 'asc' ? 1 : 0.25" d="M5 0L9.33 5H0.67z"/>
                    <path :opacity="sortCol === ci && sortDir === 'desc' ? 1 : 0.25" d="M5 14L0.67 9H9.33z"/>
                  </svg>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, ri) in filteredRows" :key="ri">
              <td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td>
            </tr>
            <tr v-if="filteredRows.length === 0">
              <td :colspan="headers.length" class="empty">无匹配数据</td>
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

const filterText = ref('')
const sortCol = ref<number | null>(null)
const sortDir = ref<'asc' | 'desc'>('asc')

const currentData = computed(() => sheetsData.value[activeSheet.value] ?? [])
const headers = computed(() => currentData.value[0] ?? [])
const dataRows = computed(() => currentData.value.slice(1))

const filteredRows = computed(() => {
  let rows = dataRows.value
  const kw = filterText.value.trim().toLowerCase()
  if (kw) {
    rows = rows.filter(row => row.some(cell => String(cell).toLowerCase().includes(kw)))
  }
  if (sortCol.value !== null) {
    const col = sortCol.value
    const dir = sortDir.value
    rows = [...rows].sort((a, b) => {
      const av = a[col] ?? ''
      const bv = b[col] ?? ''
      const an = Number(av), bn = Number(bv)
      const cmp = (!isNaN(an) && !isNaN(bn)) ? an - bn : String(av).localeCompare(String(bv), 'zh')
      return dir === 'asc' ? cmp : -cmp
    })
  }
  return rows
})

function toggleSort(ci: number) {
  if (sortCol.value === ci) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortCol.value = ci
    sortDir.value = 'asc'
  }
}

function clearFilter() {
  filterText.value = ''
  sortCol.value = null
  sortDir.value = 'asc'
}

function switchSheet(name: string) {
  activeSheet.value = name
  clearFilter()
}

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
.sheet-tabs { display: flex; gap: 4px; padding: 8px 12px; background: var(--bg-subtle); border-bottom: 1px solid var(--border); flex-shrink: 0; flex-wrap: wrap; }
.tab {
  padding: 4px 12px; border: 1px solid var(--btn-border); background: var(--btn-bg);
  cursor: pointer; border-radius: 4px 4px 0 0; font-size: 13px; color: var(--btn-text);
}
.tab.active { background: #1677ff; color: #fff; border-color: #1677ff; }

.filter-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; border-bottom: 1px solid var(--border);
  background: var(--bg-base); flex-shrink: 0;
}
.filter-input {
  flex: 1; max-width: 280px;
  padding: 4px 8px; border: 1px solid var(--border); border-radius: 4px;
  font-size: 13px; background: var(--bg-subtle); color: var(--text-secondary);
  outline: none;
}
.filter-input:focus { border-color: #1677ff; }
.row-count { font-size: 12px; color: var(--text-faint); white-space: nowrap; }
.clear-btn {
  padding: 3px 10px; font-size: 12px; border: 1px solid var(--btn-border);
  border-radius: 4px; background: var(--btn-bg); color: var(--btn-text); cursor: pointer;
}
.clear-btn:hover { border-color: #1677ff; color: #1677ff; }

.table-wrap { flex: 1; overflow: auto; padding: 8px; }
table { border-collapse: collapse; font-size: 13px; width: max-content; }
th {
  border: 1px solid var(--border-muted); padding: 5px 8px;
  background: var(--bg-subtle); color: var(--text-secondary);
  white-space: nowrap; cursor: pointer; user-select: none;
  position: sticky; top: 0; z-index: 1;
}
th.sortable { padding-right: 24px; position: relative; }
th:hover { background: var(--bg-muted); }
th.asc, th.desc { color: #1677ff; }
.sort-icon {
  position: absolute; right: 5px; top: 50%; transform: translateY(-50%);
  display: flex; align-items: center; color: var(--text-faint);
}
th.asc .sort-icon, th.desc .sort-icon { color: #1677ff; }
td { border: 1px solid var(--border-muted); padding: 4px 8px; white-space: nowrap; min-width: 60px; color: var(--text-secondary); }
tr:nth-child(even) td { background: var(--bg-subtle); }
td.empty { text-align: center; color: var(--text-faint); padding: 24px; }
.loading, .error { padding: 32px; text-align: center; color: var(--text-muted); }
.error { color: #e53e3e; }
</style>
