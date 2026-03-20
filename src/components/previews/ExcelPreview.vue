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
          @input="onFilterInput"
        />
        <span class="row-count">{{ filteredRows.length }} / {{ dataRows.length }} 行</span>
        <button v-if="filterText || sortCol !== null" class="clear-btn" @click="clearFilter">重置</button>
      </div>
      <!-- Virtual table -->
      <div class="table-wrap" ref="scrollEl" @scroll.passive="onScroll">
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
            <!-- 顶部占位 -->
            <tr v-if="visibleStart > 0" :style="{ height: visibleStart * ROW_H + 'px' }"><td :colspan="headers.length || 1" /></tr>
            <tr v-for="(row, ri) in visibleRows" :key="visibleStart + ri">
              <td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td>
            </tr>
            <!-- 底部占位 -->
            <tr v-if="visibleEnd < filteredRows.length" :style="{ height: (filteredRows.length - visibleEnd) * ROW_H + 'px' }"><td :colspan="headers.length || 1" /></tr>
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
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { readFileAsArrayBuffer } from '../../utils/fileType'

const props = defineProps<{ file: File }>()
const loading = ref(true)
const error = ref('')
const sheetNames = ref<string[]>([])
const activeSheet = ref('')

// 只缓存已解析过的 sheet，按需解析
const sheetsCache = ref<Record<string, string[][]>>({})
const sheetLoading = ref(false)

// workbook 实例复用
let wb: import('xlsx').WorkBook | null = null

const filterText = ref('')
const sortCol = ref<number | null>(null)
const sortDir = ref<'asc' | 'desc'>('asc')

const currentData = computed(() => sheetsCache.value[activeSheet.value] ?? [])
const headers = computed(() => currentData.value[0] ?? [])
const dataRows = computed(() => currentData.value.slice(1))

// 过滤 + 排序，用 filterText 防抖后的值驱动
const debouncedFilter = ref('')
let filterTimer: ReturnType<typeof setTimeout> | null = null
function onFilterInput() {
  if (filterTimer) clearTimeout(filterTimer)
  filterTimer = setTimeout(() => { debouncedFilter.value = filterText.value }, 200)
}

const filteredRows = computed(() => {
  let rows = dataRows.value
  const kw = debouncedFilter.value.trim().toLowerCase()
  if (kw) {
    rows = rows.filter(row => row.some(cell => String(cell).toLowerCase().includes(kw)))
  }
  if (sortCol.value !== null) {
    const col = sortCol.value
    const dir = sortDir.value
    rows = [...rows].sort((a, b) => {
      const av = a[col] ?? '', bv = b[col] ?? ''
      const an = Number(av), bn = Number(bv)
      const cmp = (!isNaN(an) && !isNaN(bn)) ? an - bn : String(av).localeCompare(String(bv), 'zh')
      return dir === 'asc' ? cmp : -cmp
    })
  }
  return rows
})

// ── 虚拟滚动 ──────────────────────────────────────────────────
const ROW_H = 28          // 每行高度 px（与 CSS 保持一致）
const OVERSCAN = 10       // 上下各多渲染几行，避免快速滚动白屏
const scrollEl = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportH = ref(600)

const visibleStart = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_H) - OVERSCAN))
const visibleEnd = computed(() => Math.min(filteredRows.value.length, Math.ceil((scrollTop.value + viewportH.value) / ROW_H) + OVERSCAN))
const visibleRows = computed(() => filteredRows.value.slice(visibleStart.value, visibleEnd.value))

function onScroll() {
  if (scrollEl.value) scrollTop.value = scrollEl.value.scrollTop
}

// 过滤/排序变化后重置滚动位置
watch(filteredRows, () => {
  scrollTop.value = 0
  nextTick(() => { if (scrollEl.value) scrollEl.value.scrollTop = 0 })
})

// ── 按需解析 sheet ─────────────────────────────────────────────
async function parseSheet(name: string) {
  if (sheetsCache.value[name] || !wb) return
  sheetLoading.value = true
  await new Promise(r => setTimeout(r, 0)) // 让 loading 先渲染
  const XLSX = await import('xlsx')
  const ws = wb.Sheets[name]
  sheetsCache.value[name] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
  sheetLoading.value = false
}

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
  debouncedFilter.value = ''
  sortCol.value = null
  sortDir.value = 'asc'
}

async function switchSheet(name: string) {
  activeSheet.value = name
  clearFilter()
  await parseSheet(name)
  // 更新 viewport 高度
  nextTick(() => {
    if (scrollEl.value) viewportH.value = scrollEl.value.clientHeight
  })
}

onMounted(async () => {
  try {
    const buffer = await readFileAsArrayBuffer(props.file)
    const XLSX = await import('xlsx')
    // dense: true 让 sheet_to_json 更快；cellFormula: false 跳过公式解析
    wb = XLSX.read(buffer, { type: 'array', dense: true, cellFormula: false, cellHTML: false })
    sheetNames.value = wb.SheetNames
    activeSheet.value = wb.SheetNames[0]
    // 只解析第一个 sheet
    await parseSheet(wb.SheetNames[0])
  } catch (e) {
    error.value = '表格解析失败：' + (e as Error).message
  } finally {
    loading.value = false
    nextTick(() => {
      if (scrollEl.value) viewportH.value = scrollEl.value.clientHeight
    })
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
  font-size: 13px; background: var(--bg-subtle); color: var(--text-secondary); outline: none;
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
td {
  border: 1px solid var(--border-muted); padding: 4px 8px;
  white-space: nowrap; min-width: 60px; height: 28px;
  color: var(--text-secondary); box-sizing: border-box;
}
tr:nth-child(even) td { background: var(--bg-subtle); }
td.empty { text-align: center; color: var(--text-faint); padding: 24px; }
.loading, .error { padding: 32px; text-align: center; color: var(--text-muted); }
.error { color: #e53e3e; }
</style>
