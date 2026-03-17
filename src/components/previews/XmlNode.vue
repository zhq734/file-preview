<template>
  <!-- 处理指令 / DOCTYPE -->
  <div v-if="node.nodeType === 7 || node.nodeType === 10" class="xml-pi">
    {{ nodeText }}
  </div>

  <!-- 注释 -->
  <div v-else-if="node.nodeType === 8" class="xml-comment">
    &lt;!--{{ (node as Comment).data }}--&gt;
  </div>

  <!-- 纯文本（忽略空白） -->
  <span v-else-if="node.nodeType === 3">
    <span v-if="trimmed" class="xml-text">{{ trimmed }}</span>
  </span>

  <!-- 元素节点 -->
  <div v-else-if="node.nodeType === 1" class="xml-element">
    <!-- 自闭合 -->
    <div v-if="!hasChildren" class="xml-line">
      <span class="indent-block" :style="{ width: depth * 20 + 'px' }" />
      <span class="tag-open">&lt;</span>
      <span class="tag-name">{{ el.tagName }}</span>
      <span v-for="attr in attrs" :key="attr.name" class="attr">
        &nbsp;<span class="attr-name">{{ attr.name }}</span><span class="attr-eq">=</span><span class="attr-val">"{{ attr.value }}"</span>
      </span>
      <span class="tag-open"> /&gt;</span>
    </div>

    <!-- 有子节点 -->
    <template v-else>
      <!-- 开始标签 -->
      <div class="xml-line" @click="toggle" style="cursor:pointer">
        <span class="indent-block" :style="{ width: depth * 20 + 'px' }" />
        <span class="toggle">{{ expanded ? '▾' : '▸' }}</span>
        <span class="tag-open">&lt;</span>
        <span class="tag-name">{{ el.tagName }}</span>
        <span v-for="attr in attrs" :key="attr.name" class="attr">
          &nbsp;<span class="attr-name">{{ attr.name }}</span><span class="attr-eq">=</span><span class="attr-val">"{{ attr.value }}"</span>
        </span>
        <span class="tag-open">&gt;</span>
        <span v-if="!expanded" class="collapsed-hint" @click.stop="toggle">…</span>
        <span v-if="!expanded" class="tag-close">&lt;/{{ el.tagName }}&gt;</span>
      </div>

      <!-- 子节点 -->
      <template v-if="expanded">
        <XmlNode
          v-for="(child, i) in childNodes"
          :key="i"
          :node="child"
          :expand-level="expandLevel"
          :depth="depth + 1"
        />
        <!-- 结束标签 -->
        <div class="xml-line">
          <span class="indent-block" :style="{ width: depth * 20 + 'px' }" />
          <span class="tag-close">&lt;/{{ el.tagName }}&gt;</span>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  node: ChildNode
  depth: number
  expandLevel: number
}>()

const el = computed(() => props.node as Element)
const attrs = computed(() => el.value.attributes ? Array.from(el.value.attributes) : [])
const childNodes = computed(() => props.node.nodeType === 1 ? Array.from(props.node.childNodes) : [])

const hasChildren = computed(() => {
  if (props.node.nodeType !== 1) return false
  return childNodes.value.some(c =>
    c.nodeType === 1 ||
    (c.nodeType === 3 && (c.textContent ?? '').trim()) ||
    c.nodeType === 8
  )
})

const trimmed = computed(() =>
  props.node.nodeType === 3 ? (props.node.textContent ?? '').trim() : ''
)

const nodeText = computed(() => {
  if (props.node.nodeType === 7) {
    const pi = props.node as ProcessingInstruction
    return `<?${pi.target} ${pi.data}?>`
  }
  return props.node.nodeType === 10 ? `<!DOCTYPE ${(props.node as DocumentType).name}>` : ''
})

const expanded = ref(props.depth < props.expandLevel)
watch(() => props.expandLevel, (lv) => { expanded.value = props.depth < lv })
const toggle = () => { expanded.value = !expanded.value }
</script>

<style scoped>
.xml-element { display: block; }
.xml-line { display: flex; align-items: baseline; white-space: pre; }
.indent-block { display: inline-block; flex-shrink: 0; }
.toggle { color: var(--text-faint); font-size: 11px; margin-right: 3px; user-select: none; width: 12px; flex-shrink: 0; }
.tag-open  { color: var(--syn-punct); }
.tag-name  { color: var(--syn-tag); font-weight: 600; }
.tag-close { color: var(--syn-punct); }
.attr-name { color: var(--syn-attr); }
.attr-eq   { color: var(--syn-punct); }
.attr-val  { color: var(--syn-attrval); }
.xml-text  { color: var(--text-secondary); }
.xml-comment { color: var(--syn-comment); font-style: italic; padding-left: 4px; }
.xml-pi    { color: var(--syn-comment); padding-left: 4px; }
.collapsed-hint {
  color: var(--text-faint); font-size: 11px; cursor: pointer;
  background: var(--bg-muted); border-radius: 3px;
  padding: 0 5px; margin: 0 3px;
}
.collapsed-hint:hover { background: #e6f4ff; color: #1677ff; }
</style>
