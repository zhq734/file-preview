<template>
  <div class="log-wrap">
    <div class="log-toolbar">
      <span class="log-count">共 {{ filteredLines.length }} / {{ lines.length }} 行</span>
      <input v-model="filterText" class="filter-input" placeholder="过滤关键词..." @input="onFilterChange" />
      <select v-model="levelFilter" class="level-select" @change="onFilterChange">
        <option value="">全部级别</option>
        <option value="error">ERROR</option>
        <option value="warn">WARN</option>
        <option value="info">INFO</option>
        <option value="debug">DEBUG</option>
        <option value="trace">TRACE</option>
      </select>
    </div>

    <div v-if="parsing" class="status">解析中...</div>

    <div v-else class="log-body" ref="bodyRef" @scroll="onScroll">
      <div :style="{ height: totalHeight + 'px', position: 'relative' }">
        <div :style="{ transform: `translateY(${offsetY}px)`, position: 'absolute', width: '100%' }">
          <div
            v-for="line in visibleLines"
            :key="line.no"
            class="log-line"
            :class="line.level"
            :style="{ height: LINE_H + 'px' }"
          >
            <span class="line-no">{{ line.no }}</span>
            <span class="line-content" v-html="line.html" />
          </div>
        </div>
      </div>
      <div v-if="!parsing && filteredLines.length === 0" class="no-result">无匹配内容</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{ text: string }>()

interface LogLine { no: number; raw: string; level: string; html: string }

const LINE_H = 22
const OVERSCAN = 20

const lines = ref<LogLine[]>([])
const filteredLines = ref<LogLine[]>([])
const parsing = ref(false)
const filterText = ref('')
const levelFilter = ref('')
const bodyRef = ref<HTMLDivElement>()
const scrollTop = ref(0)
const clientHeight = ref(600)

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function detectLevel(raw: string): string {
  const u = raw.toUpperCase()
  if (/\b(ERROR|SEVERE|FATAL|CRITICAL)\b/.test(u)) return 'error'
  if (/\b(WARN(?:ING)?)\b/.test(u)) return 'warn'
  if (/\bINFO\b/.test(u)) return 'info'
  if (/\bDEBUG\b/.test(u)) return 'debug'
  if (/\bTRACE\b/.test(u)) return 'trace'
  if (/^\s+(at |Caused by:|\.{3}\s+\d+ more)/.test(raw)) return 'stack'
  return ''
}
function highlight(raw: string): string {
  let s = escHtml(raw)
  s = s.replace(/(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/g, '<span class="hl-time">$1</span>')
  s = s.replace(/\b(ERROR|SEVERE|FATAL|CRITICAL)\b/g, '<span class="hl-error">$1</span>')
  s = s.replace(/\b(WARN(?:ING)?)\b/g, '<span class="hl-warn">$1</span>')
  s = s.replace(/\bINFO\b/g, '<span class="hl-info">INFO</span>')
  s = s.replace(/\bDEBUG\b/g, '<span class="hl-debug">DEBUG</span>')
  s = s.replace(/\bTRACE\b/g, '<span class="hl-trace">TRACE</span>')
  s = s.replace(/(\[[^\]]{1,60}\])/g, '<span class="hl-thread">$1</span>')
  s = s.replace(/\b([A-Z][A-Za-z0-9$]*(?:Exception|Error|Throwable))\b/g, '<span class="hl-exception">$1</span>')
  return s
}

async function parseText(text: string) {
  parsing.value = true
  filterText.value = ''
  levelFilter.value = ''
  const rawLines = text.split('\n')
  const result: LogLine[] = []
  const BATCH = 5000
  for (let i = 0; i < rawLines.length; i += BATCH) {
    rawLines.slice(i, i + BATCH).forEach((raw, j) => {
      result.push({ no: i + j + 1, raw, level: detectLevel(raw), html: highlight(raw) })
    })
    await new Promise(r => setTimeout(r, 0))
  }
  lines.value = result
  filteredLines.value = result
  parsing.value = false
  if (bodyRef.value) bodyRef.value.scrollTop = 0
  scrollTop.value = 0
}

let filterTimer = 0
function applyFilter() {
  const kw = filterText.value.trim().toLowerCase()
  const lv = levelFilter.value
  filteredLines.value = lines.value.filter(l =>
    (!lv || l.level === lv) && (!kw || l.raw.toLowerCase().includes(kw))
  )
  if (bodyRef.value) bodyRef.value.scrollTop = 0
  scrollTop.value = 0
}
function onFilterChange() {
  clearTimeout(filterTimer)
  filterTimer = window.setTimeout(applyFilter, 200)
}

const totalHeight = computed(() => filteredLines.value.length * LINE_H)
const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / LINE_H) - OVERSCAN))
const endIndex = computed(() => Math.min(filteredLines.value.length, Math.ceil((scrollTop.value + clientHeight.value) / LINE_H) + OVERSCAN))
const visibleLines = computed(() => filteredLines.value.slice(startIndex.value, endIndex.value))
const offsetY = computed(() => startIndex.value * LINE_H)

function onScroll() {
  if (bodyRef.value) scrollTop.value = bodyRef.value.scrollTop
}

onMounted(() => {
  if (bodyRef.value) clientHeight.value = bodyRef.value.clientHeight
  if (props.text) parseText(props.text)
})

// 当 text prop 变化时重新解析（压缩包切换文件场景）
watch(() => props.text, (val) => { if (val) parseText(val) })

onBeforeUnmount(() => clearTimeout(filterTimer))
</script>

<style scoped>
.log-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; background: #1e1e1e; color: #d4d4d4; font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace; font-size: 13px; }
.log-toolbar { display: flex; align-items: center; gap: 12px; padding: 8px 16px; background: #2d2d2d; border-bottom: 1px solid #3e3e3e; flex-shrink: 0; }
.log-count { color: #888; font-size: 12px; white-space: nowrap; }
.filter-input { flex: 1; padding: 4px 10px; background: #3c3c3c; border: 1px solid #555; border-radius: 4px; color: #d4d4d4; font-size: 13px; outline: none; }
.filter-input:focus { border-color: #1677ff; }
.level-select { padding: 4px 8px; background: #3c3c3c; border: 1px solid #555; border-radius: 4px; color: #d4d4d4; font-size: 13px; outline: none; }
.status { padding: 32px; text-align: center; color: #888; }
.log-body { flex: 1; overflow: auto; }
.log-line { display: flex; align-items: baseline; border-left: 3px solid transparent; box-sizing: border-box; }
.log-line:hover { background: rgba(255,255,255,0.04); }
.log-line.error { background: rgba(220,38,38,0.12); border-left-color: #dc2626; }
.log-line.warn  { background: rgba(234,179,8,0.08); border-left-color: #eab308; }
.log-line.stack { opacity: 0.7; }
.log-line.debug { opacity: 0.75; }
.log-line.trace { opacity: 0.55; }
.line-no { min-width: 52px; padding: 0 12px 0 8px; color: #555; text-align: right; user-select: none; flex-shrink: 0; font-size: 11px; line-height: 22px; }
.line-content { white-space: pre; overflow: hidden; text-overflow: ellipsis; flex: 1; padding-right: 16px; line-height: 22px; }
.no-result { padding: 32px; text-align: center; color: #666; }
</style>

<style>
.hl-time      { color: #9cdcfe; }
.hl-error     { color: #f44747; font-weight: bold; }
.hl-warn      { color: #dcdcaa; font-weight: bold; }
.hl-info      { color: #4ec9b0; font-weight: bold; }
.hl-debug     { color: #569cd6; font-weight: bold; }
.hl-trace     { color: #808080; font-weight: bold; }
.hl-thread    { color: #c586c0; }
.hl-exception { color: #f44747; font-style: italic; }
</style>
