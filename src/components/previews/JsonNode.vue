<template>
  <span class="json-node">
    <!-- 对象 / 数组 -->
    <template v-if="isObject || isArray">
      <span class="toggle" @click="toggle">{{ expanded ? '▾' : '▸' }}</span>
      <span class="bracket open" @click="toggle">{{ isArray ? '[' : '{' }}</span>

      <template v-if="expanded">
        <div class="children">
          <div v-for="(val, key, idx) in data" :key="key" class="child-row">
            <span class="indent" />
            <span v-if="!isArray" class="key">"{{ key }}"<span class="colon">: </span></span>
            <JsonNode :data="val" :expand-level="expandLevel" :depth="depth + 1" />
            <span v-if="idx < childCount - 1" class="comma">,</span>
          </div>
        </div>
        <span class="bracket close">{{ isArray ? ']' : '}' }}</span>
      </template>

      <template v-else>
        <span class="collapsed-hint" @click="toggle">
          {{ isArray ? `${childCount} items` : `${childCount} keys` }}
        </span>
        <span class="bracket close">{{ isArray ? ']' : '}' }}</span>
      </template>
    </template>

    <!-- 基本类型 -->
    <template v-else>
      <span :class="valueClass">{{ displayValue }}</span>
    </template>
  </span>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  data: unknown
  depth: number
  expandLevel: number
}>()

const isArray  = computed(() => Array.isArray(props.data))
const isObject = computed(() => !isArray.value && typeof props.data === 'object' && props.data !== null)
const childCount = computed(() => {
  if (!props.data || typeof props.data !== 'object') return 0
  return Object.keys(props.data as object).length
})

// expandLevel 变化时同步展开/收起
const expanded = ref(props.depth < props.expandLevel)
watch(() => props.expandLevel, (lv) => { expanded.value = props.depth < lv })

const toggle = () => { expanded.value = !expanded.value }

const valueClass = computed(() => {
  const t = typeof props.data
  if (props.data === null) return 'val-null'
  if (t === 'boolean') return 'val-bool'
  if (t === 'number') return 'val-num'
  return 'val-str'
})

const displayValue = computed(() => {
  if (props.data === null) return 'null'
  if (typeof props.data === 'string') return `"${props.data}"`
  return String(props.data)
})
</script>

<style scoped>
.json-node { display: inline; }
.toggle { cursor: pointer; color: var(--text-faint); font-size: 11px; margin-right: 2px; user-select: none; }
.toggle:hover { color: var(--text-secondary); }
.bracket { color: var(--syn-punct); cursor: pointer; }
.bracket:hover { color: #1677ff; }
.children { display: block; padding-left: 20px; }
.child-row { display: block; }
.indent { display: inline-block; }
.key { color: var(--syn-key); }
.colon { color: var(--syn-punct); }
.comma { color: var(--syn-punct); }
.collapsed-hint {
  color: var(--text-faint); font-size: 11px; cursor: pointer;
  background: var(--bg-muted); border-radius: 3px;
  padding: 0 6px; margin: 0 4px;
}
.collapsed-hint:hover { background: #e6f4ff; color: #1677ff; }
.val-str  { color: var(--syn-str); }
.val-num  { color: var(--syn-num); }
.val-bool { color: var(--syn-bool); }
.val-null { color: var(--syn-null); }
</style>
