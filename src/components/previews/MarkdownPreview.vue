<template>
  <div class="md-wrap">
    <div v-if="loading" class="status">加载中...</div>
    <div v-else class="md-body" v-html="html" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { marked } from 'marked'
import { readFileAsText } from '../../utils/fileType'

const props = defineProps<{ file: File }>()
const loading = ref(true)
const html = ref('')

onMounted(async () => {
  const text = await readFileAsText(props.file)
  html.value = await marked(text)
  loading.value = false
})
</script>

<style scoped>
.md-wrap {
  width: 100%;
  height: 100%;
  overflow: auto;
  background: var(--bg-base);
}
.status {
  padding: 32px;
  text-align: center;
  color: var(--text-muted);
}
.md-body {
  max-width: 860px;
  margin: 0 auto;
  padding: 40px 48px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 15px;
  line-height: 1.8;
  color: var(--text-secondary);
  box-sizing: border-box;
}
</style>

<style>
.md-body h1, .md-body h2, .md-body h3,
.md-body h4, .md-body h5, .md-body h6 {
  font-weight: 600;
  line-height: 1.4;
  margin: 1.2em 0 0.5em;
  color: var(--text-primary);
}
.md-body h1 { font-size: 28px; border-bottom: 1px solid var(--border-muted); padding-bottom: 0.3em; }
.md-body h2 { font-size: 22px; border-bottom: 1px solid var(--border-muted); padding-bottom: 0.3em; }
.md-body h3 { font-size: 18px; }
.md-body h4 { font-size: 16px; }
.md-body p  { margin: 0 0 1em; }
.md-body a  { color: #0969da; text-decoration: none; }
.md-body a:hover { text-decoration: underline; }
.md-body strong { font-weight: 600; }
.md-body em { font-style: italic; }
.md-body code {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
  background: var(--code-bg);
  padding: 2px 6px;
  border-radius: 4px;
  color: #e36209;
}
.md-body pre {
  background: var(--code-bg);
  border-radius: 6px;
  padding: 16px;
  overflow: auto;
  margin: 0 0 1em;
}
.md-body pre code {
  background: none;
  padding: 0;
  color: var(--code-text);
  font-size: 13px;
}
.md-body blockquote {
  border-left: 4px solid var(--border);
  margin: 0 0 1em;
  padding: 4px 16px;
  color: var(--text-muted);
}
.md-body ul, .md-body ol {
  padding-left: 2em;
  margin: 0 0 1em;
}
.md-body li { margin-bottom: 0.3em; }
.md-body table {
  border-collapse: collapse;
  width: 100%;
  margin: 0 0 1em;
}
.md-body th, .md-body td {
  border: 1px solid var(--table-border);
  padding: 8px 12px;
  text-align: left;
}
.md-body th { background: var(--table-head-bg); font-weight: 600; }
.md-body tr:nth-child(even) td { background: var(--table-stripe); }
.md-body img { max-width: 100%; height: auto; border-radius: 4px; }
.md-body hr { border: none; border-top: 1px solid var(--border); margin: 1.5em 0; }
</style>
