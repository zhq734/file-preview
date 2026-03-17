<template>
  <div class="sql-wrap">
    <div class="toolbar">
      <button class="tb-btn" @click="expandAll">全部展开</button>
      <button class="tb-btn" @click="collapseAll">全部收起</button>
      <span class="stmt-count">共 {{ statements.length }} 条语句</span>
    </div>
    <div class="sql-body">
      <div
        v-for="(stmt, i) in statements"
        :key="i"
        class="stmt-block"
        :class="stmt.type"
      >
        <!-- 语句头部（点击折叠） -->
        <div class="stmt-header" @click="toggleStmt(i)">
          <span class="toggle">{{ collapsed[i] ? '▸' : '▾' }}</span>
          <span class="stmt-badge" :class="stmt.type">{{ stmt.type.toUpperCase() }}</span>
          <span class="stmt-preview">{{ stmt.preview }}</span>
          <span v-if="collapsed[i]" class="stmt-lines">{{ stmt.lines }} 行</span>
        </div>
        <!-- 语句内容 -->
        <pre v-if="!collapsed[i]" class="stmt-body" v-html="stmt.html" />
      </div>
      <div v-if="statements.length === 0" class="empty">无内容</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { readFileAsText } from '../../utils/fileType'
import hljs from 'highlight.js/lib/core'
import sql from 'highlight.js/lib/languages/sql'
import 'highlight.js/styles/github.css'

hljs.registerLanguage('sql', sql)

const props = defineProps<{ file: File }>()

interface Statement {
  raw: string
  html: string
  preview: string
  type: string
  lines: number
}

const statements = ref<Statement[]>([])
const collapsed = ref<boolean[]>([])

function detectType(sql: string): string {
  const first = sql.trimStart().split(/\s+/)[0].toLowerCase()
  const map: Record<string, string> = {
    select: 'select', insert: 'insert', update: 'update', delete: 'delete',
    create: 'create', drop: 'drop', alter: 'alter', truncate: 'truncate',
    with: 'select', explain: 'select',
  }
  return map[first] ?? 'other'
}

function splitStatements(text: string): string[] {
  // 按分号分割，保留注释块，忽略字符串内的分号
  const stmts: string[] = []
  let current = ''
  let inStr = false
  let strChar = ''
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inLineComment) {
      current += ch
      if (ch === '\n') inLineComment = false
      continue
    }
    if (inBlockComment) {
      current += ch
      if (ch === '*' && next === '/') { current += '/'; i++; inBlockComment = false }
      continue
    }
    if (!inStr && ch === '-' && next === '-') { inLineComment = true; current += ch; continue }
    if (!inStr && ch === '/' && next === '*') { inBlockComment = true; current += ch; continue }
    if (!inStr && (ch === "'" || ch === '"' || ch === '`')) { inStr = true; strChar = ch }
    else if (inStr && ch === strChar && text[i - 1] !== '\\') { inStr = false }

    if (!inStr && ch === ';') {
      current += ch
      const trimmed = current.trim()
      if (trimmed && trimmed !== ';') stmts.push(trimmed)
      current = ''
    } else {
      current += ch
    }
  }
  const last = current.trim()
  if (last) stmts.push(last)
  return stmts
}

onMounted(async () => {
  const text = await readFileAsText(props.file)
  const stmts = splitStatements(text)
  statements.value = stmts.map(raw => {
    const firstLine = raw.split('\n')[0].replace(/\s+/g, ' ').slice(0, 60)
    return {
      raw,
      html: hljs.highlight(raw, { language: 'sql' }).value,
      preview: firstLine,
      type: detectType(raw),
      lines: raw.split('\n').length,
    }
  })
  collapsed.value = statements.value.map(() => false)
})

const toggleStmt = (i: number) => { collapsed.value[i] = !collapsed.value[i] }
const expandAll  = () => { collapsed.value = collapsed.value.map(() => false) }
const collapseAll = () => { collapsed.value = collapsed.value.map(() => true) }
</script>

<style scoped>
.sql-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--bg-base); }
.toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-bottom: 1px solid var(--border-muted); flex-shrink: 0; }
.stmt-count { font-size: 12px; color: var(--text-faint); margin-left: auto; }
.tb-btn { padding: 3px 10px; font-size: 12px; border: 1px solid var(--btn-border); border-radius: 4px; background: var(--btn-bg); cursor: pointer; color: var(--btn-text); }
.tb-btn:hover { border-color: var(--btn-hover-border); color: var(--btn-hover-text); }
.sql-body { flex: 1; overflow: auto; padding: 8px 0; }
.stmt-block { border-left: 3px solid #e8e8e8; margin: 4px 12px; border-radius: 0 4px 4px 0; }
.stmt-block.select { border-left-color: #1677ff; }
.stmt-block.insert { border-left-color: #52c41a; }
.stmt-block.update { border-left-color: #fa8c16; }
.stmt-block.delete { border-left-color: #f5222d; }
.stmt-block.create { border-left-color: #722ed1; }
.stmt-block.drop   { border-left-color: #eb2f96; }
.stmt-block.alter  { border-left-color: #13c2c2; }
.stmt-header {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 10px; cursor: pointer;
  background: var(--bg-subtle); border-radius: 0 4px 0 0;
  user-select: none;
}
.stmt-header:hover { background: var(--bg-muted); }
.toggle { color: var(--text-faint); font-size: 11px; width: 12px; flex-shrink: 0; }
.stmt-badge {
  font-size: 11px; font-weight: 600; padding: 1px 6px;
  border-radius: 3px; flex-shrink: 0;
  background: var(--bg-muted); color: var(--btn-text);
}
.stmt-badge.select { background: #e6f4ff; color: #1677ff; }
.stmt-badge.insert { background: #f6ffed; color: #52c41a; }
.stmt-badge.update { background: #fff7e6; color: #fa8c16; }
.stmt-badge.delete { background: #fff1f0; color: #f5222d; }
.stmt-badge.create { background: #f9f0ff; color: #722ed1; }
.stmt-badge.drop   { background: #fff0f6; color: #eb2f96; }
.stmt-badge.alter  { background: #e6fffb; color: #13c2c2; }
.stmt-preview { flex: 1; font-size: 12px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'SFMono-Regular', Consolas, monospace; }
.stmt-lines { font-size: 11px; color: var(--text-placeholder); flex-shrink: 0; }
.stmt-body { margin: 0; padding: 10px 16px; font-size: 13px; line-height: 1.6; font-family: 'SFMono-Regular', Consolas, monospace; overflow-x: auto; background: var(--bg-base); color: var(--code-text); }
.empty { padding: 32px; text-align: center; color: var(--text-faint); }
</style>
