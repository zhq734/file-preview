<template>
  <div class="image-wrap" ref="wrapRef" @wheel.prevent="onWheel">
    <!-- 工具栏 -->
    <div class="toolbar">
      <button class="tb-btn" @click="zoomOut" title="缩小 (-)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
      </button>
      <span class="zoom-label" @click="resetTransform" title="点击重置">{{ Math.round(scale * 100) }}%</span>
      <button class="tb-btn" @click="zoomIn" title="放大 (+)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
      </button>
      <div class="divider" />
      <button class="tb-btn" @click="rotateLeft" title="向左旋转">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
      </button>
      <button class="tb-btn" @click="rotateRight" title="向右旋转">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-4.5"/></svg>
      </button>
      <div class="divider" />
      <button class="tb-btn" @click="flipH" title="水平翻转">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
      </button>
      <button class="tb-btn" @click="resetTransform" title="重置">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
      </button>
      <div class="divider" />
      <!-- 底色预设 -->
      <span class="bg-label">底色</span>
      <button
        v-for="bg in BG_PRESETS" :key="bg.value"
        class="bg-swatch"
        :class="{ active: bgColor === bg.value }"
        :style="{ background: bg.value === 'checker' ? undefined : bg.value }"
        :title="bg.label"
        @click="bgColor = bg.value"
      >
        <span v-if="bg.value === 'checker'" class="checker-icon" />
      </button>
      <input type="color" class="color-picker" :value="customColor" @input="onCustomColor" title="自定义颜色" />
    </div>

    <!-- 图片容器（支持拖拽平移） -->
    <div
      class="canvas"
      ref="canvasRef"
      :class="{ 'bg-checker': bgColor === 'checker' }"
      :style="{ background: bgColor !== 'checker' ? bgColor : undefined }"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
    >
      <img
        :src="url"
        :alt="file.name"
        class="preview-img"
        :style="imgStyle"
        draggable="false"
        @load="onImgLoad"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { createObjectURL } from '../../utils/fileType'

const props = defineProps<{ file: File }>()

const url = ref('')
const scale = ref(1)
const rotate = ref(0)
const flipX = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const wrapRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLDivElement>()

// 底色
const BG_PRESETS = [
  { label: '棋盘格（透明）', value: 'checker' },
  { label: '深色', value: '#1a1a1a' },
  { label: '白色', value: '#ffffff' },
  { label: '浅灰', value: '#f0f0f0' },
]
const bgColor = ref('#ffffff')
const customColor = ref('#ffffff')
function onCustomColor(e: Event) {
  customColor.value = (e.target as HTMLInputElement).value
  bgColor.value = customColor.value
}

// 拖拽状态
let dragging = false
let dragStartX = 0
let dragStartY = 0
let dragOriginX = 0
let dragOriginY = 0

const imgStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px) rotate(${rotate.value}deg) scale(${scale.value * flipX.value}, ${scale.value})`,
  cursor: dragging ? 'grabbing' : 'grab',
  transition: dragging ? 'none' : 'transform 0.15s ease',
}))

function onImgLoad(e: Event) {
  // 图片加载后自适应容器
  const img = e.target as HTMLImageElement
  const wrap = canvasRef.value
  if (!wrap) return
  const ww = wrap.clientWidth - 32
  const wh = wrap.clientHeight - 32
  const ratio = Math.min(ww / img.naturalWidth, wh / img.naturalHeight, 1)
  scale.value = ratio
}

const STEP = 0.15
const MIN = 0.05
const MAX = 10

function zoomIn()  { scale.value = Math.min(MAX, +(scale.value + STEP).toFixed(2)) }
function zoomOut() { scale.value = Math.max(MIN, +(scale.value - STEP).toFixed(2)) }
function rotateLeft()  { rotate.value = (rotate.value - 90 + 360) % 360 }
function rotateRight() { rotate.value = (rotate.value + 90) % 360 }
function flipH() { flipX.value *= -1 }
function resetTransform() {
  scale.value = 1; rotate.value = 0; flipX.value = 1
  translateX.value = 0; translateY.value = 0
}

// 滚轮缩放
function onWheel(e: WheelEvent) {
  const delta = e.deltaY > 0 ? -STEP : STEP
  scale.value = Math.min(MAX, Math.max(MIN, +(scale.value + delta).toFixed(2)))
}

// 拖拽平移
function onMouseDown(e: MouseEvent) {
  dragging = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragOriginX = translateX.value
  dragOriginY = translateY.value
}
function onMouseMove(e: MouseEvent) {
  if (!dragging) return
  translateX.value = dragOriginX + (e.clientX - dragStartX)
  translateY.value = dragOriginY + (e.clientY - dragStartY)
}
function onMouseUp() { dragging = false }

// 键盘快捷键
function onKeydown(e: KeyboardEvent) {
  if (e.key === '+' || e.key === '=') zoomIn()
  if (e.key === '-') zoomOut()
  if (e.key === 'r' || e.key === 'R') rotateRight()
  if (e.key === '0') resetTransform()
}

onMounted(() => {
  url.value = createObjectURL(props.file)
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  if (url.value) URL.revokeObjectURL(url.value)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.image-wrap {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.toolbar {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 12px;
  background: var(--bg-toolbar);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.tb-btn {
  background: var(--btn-bg); border: 1px solid var(--btn-border); cursor: pointer;
  color: var(--btn-text); padding: 4px 8px; border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.tb-btn:hover { border-color: var(--btn-hover-border); color: var(--btn-hover-text); }
.zoom-label {
  min-width: 48px; text-align: center;
  font-size: 12px; color: var(--text-muted); cursor: pointer;
  padding: 4px 6px; border-radius: 4px;
}
.zoom-label:hover { background: var(--bg-muted); color: var(--text-secondary); }
.divider { width: 1px; height: 18px; background: var(--border); margin: 0 4px; }
.bg-label { font-size: 12px; color: var(--text-faint); margin: 0 2px 0 4px; white-space: nowrap; }
.bg-swatch {
  width: 20px; height: 20px; border-radius: 3px; cursor: pointer; flex-shrink: 0;
  border: 2px solid transparent; padding: 0;
  transition: border-color 0.15s;
}
.bg-swatch.active { border-color: #1677ff; }
.bg-swatch:hover { border-color: var(--btn-hover-border); }
.checker-icon {
  display: block; width: 100%; height: 100%; border-radius: 2px;
  background-image:
    linear-gradient(45deg, #888 25%, transparent 25%),
    linear-gradient(-45deg, #888 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #888 75%),
    linear-gradient(-45deg, transparent 75%, #888 75%);
  background-size: 8px 8px;
  background-position: 0 0, 0 4px, 4px -4px, -4px 0;
  background-color: #ccc;
}
.color-picker {
  width: 24px; height: 24px; border: none; padding: 0; cursor: pointer;
  border-radius: 3px; background: none; overflow: hidden;
}
.color-picker::-webkit-color-swatch-wrapper { padding: 0; }
.color-picker::-webkit-color-swatch { border: 2px solid var(--border); border-radius: 3px; }
.canvas {
  flex: 1; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  position: relative;
}
.bg-checker {
  background-image:
    linear-gradient(45deg, #888 25%, transparent 25%),
    linear-gradient(-45deg, #888 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #888 75%),
    linear-gradient(-45deg, transparent 75%, #888 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
  background-color: #bbb;
}
.preview-img {
  max-width: none;
  user-select: none;
  -webkit-user-drag: none;
}
</style>
