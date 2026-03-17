<template>
  <div class="code-wrap">
    <table class="props-table">
      <thead>
        <tr>
          <th>Key</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="i" :class="row.type">
          <template v-if="row.type === 'comment'">
            <td colspan="2" class="comment-cell">{{ row.raw }}</td>
          </template>
          <template v-else-if="row.type === 'pair'">
            <td class="key-cell">{{ row.key }}</td>
            <td class="val-cell">{{ row.value }}</td>
          </template>
          <template v-else>
            <td colspan="2" class="empty-cell" />
          </template>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { readFileAsText } from '../../utils/fileType'

const props = defineProps<{ file: File }>()

type Row =
  | { type: 'pair'; key: string; value: string }
  | { type: 'comment'; raw: string }
  | { type: 'empty' }

const rows = ref<Row[]>([])

onMounted(async () => {
  const text = await readFileAsText(props.file)
  rows.value = text.split('\n').map(line => {
    const trimmed = line.trim()
    if (!trimmed) return { type: 'empty' } as Row
    if (trimmed.startsWith('#') || trimmed.startsWith('!')) return { type: 'comment', raw: trimmed } as Row
    // 支持 = 和 : 两种分隔符
    const sep = trimmed.match(/^([^=:]+?)(\s*[=:]\s*)(.*)$/)
    if (sep) return { type: 'pair', key: sep[1].trim(), value: sep[3] } as Row
    return { type: 'pair', key: trimmed, value: '' } as Row
  })
})
</script>

<style scoped>
.code-wrap {
  width: 100%; height: 100%; overflow: auto;
  padding: 16px; box-sizing: border-box; background: var(--bg-base);
}
.props-table {
  width: 100%; border-collapse: collapse;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
}
.props-table thead th {
  background: var(--table-head-bg);
  border: 1px solid var(--table-border);
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  color: var(--text-muted);
  position: sticky; top: 0;
}
.props-table td {
  border: 1px solid var(--border-muted);
  padding: 6px 12px;
  vertical-align: top;
}
.key-cell { color: #0550ae; white-space: nowrap; width: 35%; }
.val-cell { color: #1a7f37; word-break: break-all; }
.comment-cell { color: var(--text-faint); font-style: italic; background: var(--bg-muted); }
.empty-cell { background: transparent; border-color: transparent; height: 8px; }
</style>
