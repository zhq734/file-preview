<template>
  <div class="tree-node">
    <!-- 目录 -->
    <div v-if="node.isDir" class="node-row dir" @click="toggle">
      <span class="indent" :style="{ width: indent + 'px' }" />
      <span class="arrow" :class="{ open: expanded }">▶</span>
      <span class="icon">📁</span>
      <span class="node-name">{{ node.name }}</span>
    </div>

    <!-- 文件 -->
    <div
      v-else
      class="node-row file"
      :class="{ selected: selectedPath === node.path }"
      @click="$emit('select', node)"
    >
      <span class="indent" :style="{ width: indent + 'px' }" />
      <span class="arrow-placeholder" />
      <span class="icon">{{ getIcon(node.name) }}</span>
      <span class="node-name">{{ node.name }}</span>
      <span class="node-size">{{ formatSize(node.size) }}</span>
    </div>

    <!-- 子节点 -->
    <template v-if="node.isDir && expanded">
      <ArchiveTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :selected-path="selectedPath"
        :depth="depth + 1"
        @select="$emit('select', $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TreeNode, ArchiveEntry } from './ArchivePreview.vue'
import { getFileCategory } from '../../utils/fileType'

const props = withDefaults(defineProps<{
  node: TreeNode
  selectedPath: string
  depth?: number
}>(), { depth: 0 })

defineEmits<{ (e: 'select', entry: ArchiveEntry): void }>()

// 默认折叠，避免大压缩包一次性渲染所有节点卡死
const expanded = ref(false)
const indent = computed(() => props.depth * 16 + 8)

const toggle = () => { expanded.value = !expanded.value }

const ICON_MAP: Record<string, string> = {
  pdf: '📄', word: '📝', excel: '📊', ppt: '📋',
  text: '📃', html: '🌐', xml: '📑', json: '{ }',
  image: '🖼️', audio: '🎵', video: '🎬', archive: '🗜️', unsupported: '📄',
}

const getIcon = (name: string) => ICON_MAP[getFileCategory(name)] ?? '📄'

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}
</script>

<style scoped>
.tree-node { user-select: none; }

.node-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px 3px 0;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  border-radius: 4px;
  margin: 1px 4px;
}
.node-row:hover { background: var(--bg-muted); }
.node-row.selected { background: #e6f4ff; color: #1677ff; }

.indent { display: inline-block; flex-shrink: 0; }

.arrow {
  width: 14px;
  flex-shrink: 0;
  font-size: 9px;
  color: var(--text-faint);
  transition: transform 0.15s;
  display: inline-block;
}
.arrow.open { transform: rotate(90deg); }
.arrow-placeholder { width: 14px; flex-shrink: 0; }

.icon { font-size: 14px; flex-shrink: 0; }

.node-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-size {
  font-size: 11px;
  color: var(--text-placeholder);
  flex-shrink: 0;
  margin-left: 4px;
}
</style>
