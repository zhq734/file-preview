<template>
  <div class="ofd-wrap">
    <div v-if="loading" class="status">解析中...</div>
    <div v-else-if="error" class="status error">{{ error }}</div>
    <div class="ofd-body" ref="bodyRef">
      <div v-if="!loading && !error && renderedPages === 0" class="status">渲染中...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'

const props = defineProps<{ file: File }>()

const loading = ref(true)
const error = ref('')
const bodyRef = ref<HTMLElement | null>(null)
const renderedPages = ref(0)

const yieldToMain = () => new Promise<void>(resolve => setTimeout(resolve, 0))

onMounted(async () => {
  try {
    const { parseOfdDocument, renderOfd } = await import('ofd-tools')

    // 1. 解析文档
    const ofdObj = await new Promise<unknown>((resolve, reject) => {
      parseOfdDocument({
        ofd: props.file,
        success(res: unknown[]) { resolve(res[0]) },
        fail(e: unknown) { reject(new Error(String(e))) },
      })
    })

    // 2. 渲染所有页（同步，但只生成 DOM 节点，不挂载）
    const container = bodyRef.value
    const width = container ? Math.min(container.clientWidth - 32, 900) : 800
    const divs = renderOfd(width, ofdObj) as HTMLElement[]

    // 3. 解析完成，隐藏 loading
    loading.value = false
    await nextTick()

    // 4. 逐页挂载，每页让出主线程避免卡顿
    const body = bodyRef.value
    if (!body) return
    for (const div of divs) {
      body.appendChild(div)
      renderedPages.value++
      await yieldToMain()
    }
  } catch (e) {
    error.value = 'OFD 解析失败：' + (e as Error).message
    loading.value = false
  }
})
</script>

<style scoped>
.ofd-wrap { width: 100%; height: 100%; overflow: auto; background: var(--bg-muted); }
.status { padding: 32px; text-align: center; color: var(--text-muted); }
.status.error { color: #e53e3e; }
.ofd-body {
  display: flex; flex-direction: column; align-items: center;
  padding: 24px 0 40px;
}
</style>

<style>
.ofd-body > div {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}
</style>
