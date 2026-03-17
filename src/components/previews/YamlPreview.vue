<template>
  <div class="code-wrap">
    <pre class="code-content" v-html="highlighted" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { readFileAsText } from '../../utils/fileType'
import hljs from 'highlight.js/lib/core'
import yaml from 'highlight.js/lib/languages/yaml'
import 'highlight.js/styles/github.css'

hljs.registerLanguage('yaml', yaml)

const props = defineProps<{ file: File }>()
const highlighted = ref('')

onMounted(async () => {
  const text = await readFileAsText(props.file)
  highlighted.value = hljs.highlight(text, { language: 'yaml' }).value
})
</script>

<style scoped>
.code-wrap { width: 100%; height: 100%; overflow: auto; padding: 16px; box-sizing: border-box; background: var(--bg-base); }
.code-content { margin: 0; font-size: 14px; line-height: 1.6; font-family: 'SFMono-Regular', Consolas, monospace; }
</style>
