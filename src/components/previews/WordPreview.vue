<template>
  <div class="word-wrap">
    <div v-if="loading" class="status">加载中...</div>
    <div v-else-if="error" class="status error">{{ error }}</div>

    <div v-else-if="isLegacyDoc" class="legacy-tip">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="56" height="56">
        <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      </svg>
      <p class="tip-title">.doc 格式无法在浏览器中预览</p>
      <p class="tip-desc">请用 Microsoft Word 或 WPS 将文件另存为 <strong>.docx</strong> 格式后重新打开。</p>
    </div>

    <div v-else class="page-wrap">
      <div class="docx-page" v-html="html" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import mammoth from 'mammoth'

const props = defineProps<{ file: File }>()

const loading = ref(true)
const error = ref('')
const html = ref('')

const isLegacyDoc = computed(() => props.file.name.toLowerCase().endsWith('.doc'))

onMounted(async () => {
  if (isLegacyDoc.value) {
    loading.value = false
    return
  }
  try {
    const buffer = await props.file.arrayBuffer()
    const result = await mammoth.convertToHtml(
      { arrayBuffer: buffer },
      {
        styleMap: [
          "p[style-name='Title'] => h1.doc-title:fresh",
          "p[style-name='标题'] => h1.doc-title:fresh",
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
          "p[style-name='标题 1'] => h1:fresh",
          "p[style-name='标题 2'] => h2:fresh",
          "p[style-name='标题 3'] => h3:fresh",
          "p[style-name='标题 4'] => h4:fresh",
          "p[style-name='标题1'] => h1:fresh",
          "p[style-name='标题2'] => h2:fresh",
          "p[style-name='标题3'] => h3:fresh",
          "p[style-name='标题4'] => h4:fresh",
          "r[style-name='Strong'] => strong",
          "r[style-name='Emphasis'] => em",
          "p[style-name='List Paragraph'] => p.list-paragraph:fresh",
        ],
        convertImage: mammoth.images.imgElement(image => {
          return image.read('base64').then(data => ({
            src: `data:${image.contentType};base64,${data}`,
          }))
        }),
      }
    )
    html.value = result.value
  } catch (e) {
    error.value = '文档解析失败：' + (e as Error).message
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.word-wrap {
  width: 100%;
  height: 100%;
  overflow: auto;
  background: var(--bg-muted);
}

.status {
  padding: 32px;
  text-align: center;
  color: var(--text-muted);
}
.status.error { color: #e53e3e; }

.legacy-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--text-faint);
  padding: 32px;
  text-align: center;
}
.tip-title { font-size: 15px; font-weight: 500; color: var(--text-muted); margin: 0; }
.tip-desc { font-size: 13px; color: var(--text-placeholder); margin: 0; line-height: 1.6; }
.tip-desc strong { color: #1677ff; }

.page-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0 40px;
  min-height: 100%;
}

.docx-page {
  background: #fff;
  width: 794px;
  min-height: 1123px;
  padding: 96px 90px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  box-sizing: border-box;
  font-family: "SimSun", "宋体", serif;
  font-size: 14px;
  line-height: 1.8;
  color: #222;
  word-break: break-word;
  overflow-wrap: break-word;
}
</style>

<style>
.docx-page h1, .docx-page h2, .docx-page h3,
.docx-page h4, .docx-page h5, .docx-page h6 {
  font-weight: bold;
  margin: 1em 0 0.5em;
  line-height: 1.5;
  color: #111;
}
.docx-page h1.doc-title {
  font-size: 26px;
  text-align: center;
  margin-bottom: 1.2em;
}
.docx-page h1 { font-size: 22px; }
.docx-page h2 { font-size: 18px; }
.docx-page h3 { font-size: 16px; }
.docx-page h4 { font-size: 15px; }
.docx-page p  { margin: 0 0 0.7em; }
.docx-page strong { font-weight: bold; }
.docx-page em { font-style: italic; }
.docx-page table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
  font-size: 13px;
}
.docx-page td, .docx-page th {
  border: 1px solid #bbb;
  padding: 6px 10px;
  vertical-align: top;
}
.docx-page th {
  background: #f5f5f5;
  font-weight: bold;
}
.docx-page img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0.5em auto;
}
.docx-page ul, .docx-page ol {
  padding-left: 2em;
  margin: 0.4em 0 0.8em;
}
.docx-page li { margin-bottom: 0.3em; }
.docx-page p.list-paragraph {
  padding-left: 2em;
  margin: 0.2em 0;
}
.docx-page a { color: #1677ff; text-decoration: underline; }
</style>
