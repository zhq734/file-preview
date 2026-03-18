<template>
  <div class="code-wrap">
    <div class="code-toolbar">
      <span class="lang-badge">{{ language.toUpperCase() }}</span>
      <span class="line-count">{{ lineCount }} 行</span>
    </div>
    <div class="code-body">
      <table class="code-table">
        <tbody>
          <tr v-for="(line, i) in lines" :key="i">
            <td class="line-no">{{ i + 1 }}</td>
            <td class="line-code" v-html="line" />
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { readFileAsText } from '../../utils/fileType'
import hljs from 'highlight.js/lib/core'
import 'highlight.js/styles/github.css'

const props = defineProps<{ file: File; language: string }>()

const rawLines = ref<string[]>([])

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const lines = computed(() => {
  const full = rawLines.value.join('\n')
  if (!full.trim()) return rawLines.value.map(escHtml)
  try {
    const result = hljs.highlight(full, { language: props.language }).value
    // 按换行拆分已高亮的 HTML（保留跨行 span 的闭合）
    return splitHighlightedLines(result)
  } catch {
    return rawLines.value.map(escHtml)
  }
})

const lineCount = computed(() => rawLines.value.length)

// 将 hljs 输出的 HTML 按 \n 拆行，同时修复跨行未闭合的 span
function splitHighlightedLines(html: string): string[] {
  const result: string[] = []
  const parts = html.split('\n')
  let openTags: string[] = []

  for (const part of parts) {
    // 在行首补上未闭合的 span
    const prefix = openTags.map(t => t).join('')
    const lineHtml = prefix + part

    // 统计本行新增/关闭的 span
    const opens = [...part.matchAll(/<span[^>]*>/g)].map(m => m[0])
    const closes = (part.match(/<\/span>/g) ?? []).length
    openTags = [...openTags, ...opens].slice(closes)

    // 在行尾补上关闭标签
    const suffix = openTags.map(() => '</span>').join('')
    result.push(lineHtml + suffix)
  }
  return result
}

onMounted(async () => {
  // 动态注册语言
  if (props.language === 'java') {
    const lang = await import('highlight.js/lib/languages/java')
    hljs.registerLanguage('java', lang.default)
  } else if (props.language === 'bash') {
    const lang = await import('highlight.js/lib/languages/bash')
    hljs.registerLanguage('bash', lang.default)
  } else if (props.language === 'dos') {
    const lang = await import('highlight.js/lib/languages/dos')
    hljs.registerLanguage('dos', lang.default)
  } else if (props.language === 'javascript') {
    const lang = await import('highlight.js/lib/languages/javascript')
    hljs.registerLanguage('javascript', lang.default)
  } else if (props.language === 'typescript') {
    const lang = await import('highlight.js/lib/languages/typescript')
    hljs.registerLanguage('typescript', lang.default)
  } else if (props.language === 'css') {
    const lang = await import('highlight.js/lib/languages/css')
    hljs.registerLanguage('css', lang.default)
  } else if (props.language === 'xml') {
    const lang = await import('highlight.js/lib/languages/xml')
    hljs.registerLanguage('xml', lang.default)
  }

  const text = await readFileAsText(props.file)
  rawLines.value = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  // 末尾空行去掉
  while (rawLines.value.length && rawLines.value[rawLines.value.length - 1] === '') {
    rawLines.value.pop()
  }
})
</script>

<style scoped>
.code-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--bg-base); }
.code-toolbar {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 16px; border-bottom: 1px solid var(--border-muted);
  background: var(--bg-subtle); flex-shrink: 0;
}
.lang-badge {
  font-size: 11px; font-weight: 600; padding: 2px 8px;
  border-radius: 4px; background: #1677ff; color: #fff; letter-spacing: 0.5px;
}
.line-count { font-size: 12px; color: var(--text-faint); }
.code-body { flex: 1; overflow: auto; }
.code-table { border-collapse: collapse; width: 100%; font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace; font-size: 13px; line-height: 1.6; }
.line-no {
  width: 1%; min-width: 48px; padding: 0 12px 0 16px;
  text-align: right; color: var(--text-placeholder);
  user-select: none; vertical-align: top;
  border-right: 1px solid var(--border-muted);
  white-space: nowrap;
}
.line-code { padding: 0 16px; white-space: pre; color: var(--text-secondary); vertical-align: top; }
tr:hover .line-no,
tr:hover .line-code { background: var(--bg-subtle); }
</style>
