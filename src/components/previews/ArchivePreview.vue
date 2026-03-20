<template>
  <div class="archive-wrap">
    <div v-if="loading" class="status-tip">解析中...</div>
    <div v-else-if="error" class="status-tip error">{{ error }}</div>

    <template v-else>
      <!-- 左侧文件树 -->
      <div class="file-tree">
        <div class="tree-header">
          <span class="archive-name" :title="file.name">{{ file.name }}</span>
          <span class="file-count">{{ flatEntries.length }} 个文件</span>
        </div>
        <div class="tree-body">
          <ArchiveTreeNode
            v-for="node in tree"
            :key="node.path"
            :node="node"
            :selected-path="selectedEntry?.path ?? ''"
            @select="onSelectEntry"
          />
        </div>
      </div>

      <!-- 右侧预览 -->
      <div class="preview-pane">
        <template v-if="selectedEntry">
          <div class="pane-header">
            <span class="entry-path" :title="selectedEntry.path">{{ selectedEntry.path }}</span>
            <span class="entry-size">{{ formatSize(selectedEntry.size) }}</span>
          </div>
          <div class="pane-body">
            <div v-if="entryLoading" class="status-tip">加载中...</div>
            <div v-else-if="entryError" class="status-tip error">{{ entryError }}</div>
            <component
              v-else-if="entryComponent && entryFile"
              :is="entryComponent"
              :file="entryFile"
              :language="entryLanguage"
              :key="selectedEntry!.path"
            />
            <div v-else class="unsupported-entry">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414A1 1 0 0 1 19 9.414V19a2 2 0 0 1-2 2z"/>
              </svg>
              <p>暂不支持预览该文件类型</p>
            </div>
          </div>
        </template>
        <div v-else class="empty-pane">
          <svg viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5" width="56" height="56">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
          </svg>
          <p>点击左侧文件查看内容</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, defineAsyncComponent } from 'vue'
import ArchiveTreeNode from './ArchiveTreeNode.vue'
import { getFileCategory } from '../../utils/fileType'

// 复用已有的各类预览组件
const COMPONENT_MAP: Record<string, ReturnType<typeof defineAsyncComponent>> = {
  pdf:        defineAsyncComponent(() => import('./PdfPreview.vue')),
  word:       defineAsyncComponent(() => import('./WordPreview.vue')),
  excel:      defineAsyncComponent(() => import('./ExcelPreview.vue')),
  ppt:        defineAsyncComponent(() => import('./PptPreview.vue')),
  text:       defineAsyncComponent(() => import('./TextPreview.vue')),
  csv:        defineAsyncComponent(() => import('./CsvPreview.vue')),
  java:       defineAsyncComponent(() => import('./CodePreview.vue')),
  bash:       defineAsyncComponent(() => import('./CodePreview.vue')),
  dos:        defineAsyncComponent(() => import('./CodePreview.vue')),
  javascript: defineAsyncComponent(() => import('./CodePreview.vue')),
  typescript: defineAsyncComponent(() => import('./CodePreview.vue')),
  css:        defineAsyncComponent(() => import('./CodePreview.vue')),
  vue:        defineAsyncComponent(() => import('./CodePreview.vue')),
  ofd:        defineAsyncComponent(() => import('./OfdPreview.vue')),
  markdown:   defineAsyncComponent(() => import('./MarkdownPreview.vue')),
  yaml:       defineAsyncComponent(() => import('./YamlPreview.vue')),
  properties: defineAsyncComponent(() => import('./PropertiesPreview.vue')),
  log:        defineAsyncComponent(() => import('./LogPreview.vue')),
  sql:        defineAsyncComponent(() => import('./SqlPreview.vue')),
  html:       defineAsyncComponent(() => import('./HtmlPreview.vue')),
  xml:        defineAsyncComponent(() => import('./XmlPreview.vue')),
  json:       defineAsyncComponent(() => import('./JsonPreview.vue')),
  image:      defineAsyncComponent(() => import('./ImagePreview.vue')),
  audio:      defineAsyncComponent(() => import('./AudioPreview.vue')),
  video:      defineAsyncComponent(() => import('./VideoPreview.vue')),
  class:      defineAsyncComponent(() => import('./ClassPreview.vue')),
  metafile:   defineAsyncComponent(() => import('./MetafilePreview.vue')),
  heic:       defineAsyncComponent(() => import('./HeicPreview.vue')),
}

const LANGUAGE_MAP: Record<string, string> = {
  java: 'java', bash: 'bash', dos: 'dos',
  javascript: 'javascript', typescript: 'typescript', css: 'css', vue: 'xml',
}

export interface ArchiveEntry {
  path: string
  name: string
  isDir: boolean
  size: number
  getData?: () => Promise<Uint8Array>
}

export interface TreeNode {
  name: string
  path: string
  isDir: boolean
  size: number
  children: TreeNode[]
  getData?: () => Promise<Uint8Array>
}

const props = defineProps<{ file: File }>()

const loading = ref(true)
const error = ref('')
const flatEntries = ref<ArchiveEntry[]>([])
const tree = ref<TreeNode[]>([])

const selectedEntry = ref<ArchiveEntry | null>(null)
const entryLoading = ref(false)
const entryError = ref('')
const entryFile = ref<File | null>(null)

const entryCategory = computed(() =>
  selectedEntry.value ? getFileCategory(selectedEntry.value.name) : ''
)
const entryComponent = computed(() =>
  entryCategory.value ? (COMPONENT_MAP[entryCategory.value] ?? null) : null
)
const entryLanguage = computed(() =>
  entryCategory.value ? (LANGUAGE_MAP[entryCategory.value] ?? '') : ''
)

// ── 修复后的 buildTree ──────────────────────────────────────────
// 用 dirMap 缓存每个目录路径对应的 children 数组，避免重复插入
function buildTree(entries: ArchiveEntry[]): TreeNode[] {
  const root: TreeNode[] = []
  // key: 目录路径（末尾带 /），value: 该目录的 children 数组
  const childrenMap = new Map<string, TreeNode[]>()
  // key: 目录路径，value: 目录节点本身（用于去重）
  const dirNodeMap = new Map<string, TreeNode>()

  childrenMap.set('', root)

  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path))

  for (const entry of sorted) {
    // 统一去掉末尾斜杠再处理
    const cleanPath = entry.path.replace(/\/$/, '')
    if (!cleanPath) continue

    const parts = cleanPath.split('/')
    const fileName = parts[parts.length - 1]

    // 确保所有父目录节点都存在
    for (let i = 0; i < parts.length - 1; i++) {
      const dirPath = parts.slice(0, i + 1).join('/') + '/'
      if (!dirNodeMap.has(dirPath)) {
        const parentPath = i === 0 ? '' : parts.slice(0, i).join('/') + '/'
        const parentChildren = childrenMap.get(parentPath) ?? root
        const dirNode: TreeNode = {
          name: parts[i],
          path: dirPath,
          isDir: true,
          size: 0,
          children: [],
        }
        dirNodeMap.set(dirPath, dirNode)
        childrenMap.set(dirPath, dirNode.children)
        parentChildren.push(dirNode)
      }
    }

    if (entry.isDir) {
      // 目录条目：确保节点存在（可能已被上面创建）
      const dirPath = cleanPath + '/'
      if (!dirNodeMap.has(dirPath)) {
        const parentPath = parts.length === 1 ? '' : parts.slice(0, -1).join('/') + '/'
        const parentChildren = childrenMap.get(parentPath) ?? root
        const dirNode: TreeNode = {
          name: fileName,
          path: dirPath,
          isDir: true,
          size: 0,
          children: [],
        }
        dirNodeMap.set(dirPath, dirNode)
        childrenMap.set(dirPath, dirNode.children)
        parentChildren.push(dirNode)
      }
    } else {
      // 文件条目
      const parentPath = parts.length === 1 ? '' : parts.slice(0, -1).join('/') + '/'
      const parentChildren = childrenMap.get(parentPath) ?? root
      parentChildren.push({
        name: fileName,
        path: entry.path,
        isDir: false,
        size: entry.size,
        children: [],
        getData: entry.getData,
      })
    }
  }

  return root
}

// ── TAR 解析（纯手写，无需额外依赖）─────────────────────────
function readTarString(bytes: Uint8Array, offset: number, len: number): string {
  let end = offset
  while (end < offset + len && bytes[end] !== 0) end++
  return new TextDecoder().decode(bytes.slice(offset, end))
}

function parseTar(data: Uint8Array, entries: ArchiveEntry[]) {
  let offset = 0
  while (offset + 512 <= data.length) {
    const header = data.slice(offset, offset + 512)
    // 全零块 = 结束标记
    if (header.every(b => b === 0)) break

    const name     = readTarString(header, 0, 100)
    const prefix   = readTarString(header, 345, 155)
    const fullPath = prefix ? prefix + '/' + name : name
    const sizeOct  = readTarString(header, 124, 12)
    const typeFlag = String.fromCharCode(header[156])
    const size     = parseInt(sizeOct.trim() || '0', 8) || 0
    const isDir    = typeFlag === '5' || fullPath.endsWith('/')

    if (fullPath && fullPath !== './') {
      const cleanPath = fullPath.replace(/\/$/, '')
      const dataOffset = offset + 512
      const dataSlice  = data.slice(dataOffset, dataOffset + size)
      entries.push({
        path: isDir ? cleanPath + '/' : cleanPath,
        name: cleanPath.split('/').pop() ?? cleanPath,
        isDir,
        size,
        getData: isDir ? undefined : async () => dataSlice,
      })
    }

    // 每个文件数据块向上对齐到 512 字节
    offset += 512 + Math.ceil(size / 512) * 512
  }
}

// ── ZIP 文件名编码修复 ─────────────────────────────────────────
// ZIP 规范中 bit 11 标记 UTF-8，但很多工具（包括 macOS Archive Utility）
// 打包 UTF-8 文件名时不设该标志位，导致 filenameUTF8 === false 不可靠。
// 策略：先尝试严格 UTF-8 解码 rawFilename，若成功则用 UTF-8 结果；
//       若解码失败（包含非法字节序列）则说明是 GBK，再用 GBK 解码。
function decodeZipFilename(entry: { filename: string; filenameUTF8: boolean; rawFilename: Uint8Array }): string {
  if (entry.filenameUTF8) return entry.filename
  try {
    // fatal: true 遇到非法 UTF-8 字节会抛异常
    return new TextDecoder('utf-8', { fatal: true }).decode(entry.rawFilename)
  } catch {
    // UTF-8 解码失败，说明是 GBK 编码（Windows 旧版压缩工具）
    try {
      return new TextDecoder('gbk').decode(entry.rawFilename)
    } catch {
      return entry.filename
    }
  }
}

// ── 解析压缩包（先 yield 让 loading UI 渲染，再执行解析）──────
async function parseArchive() {
  loading.value = true
  error.value = ''

  // 让 loading 状态先渲染到屏幕
  await new Promise(r => setTimeout(r, 30))

  try {
    const ext = props.file.name.split('.').pop()?.toLowerCase() ?? ''
    const entries: ArchiveEntry[] = []

    if (ext === 'zip' || ext === 'jar' || ext === 'war' || ext === 'apk') {
      const { BlobReader, ZipReader } = await import('@zip.js/zip.js')
      const reader = new ZipReader(new BlobReader(props.file))
      const zipEntries = await reader.getEntries()
      for (const e of zipEntries) {
        // 当 ZIP entry 未设置 UTF-8 标志位时，用 GBK 解码原始文件名字节
        // 这是 Windows 下用旧版压缩工具打包中文文件名的常见情况
        const filename = decodeZipFilename(e)
        entries.push({
          path: filename,
          name: filename.replace(/\/$/, '').split('/').pop() ?? filename,
          isDir: e.directory,
          size: e.uncompressedSize,
          getData: e.directory ? undefined : async () => {
            const { Uint8ArrayWriter: UW } = await import('@zip.js/zip.js')
            return e.getData!(new UW())
          },
        })
      }
      await reader.close()
    } else if (ext === 'tar') {
      const buf = await props.file.arrayBuffer()
      parseTar(new Uint8Array(buf), entries)
    } else if (ext === 'gz' || ext === 'tgz') {
      const buf = await props.file.arrayBuffer()
      const { gunzipSync } = await import('fflate')
      const data = gunzipSync(new Uint8Array(buf))
      // tgz = tar + gz，解压后再解析 tar
      if (ext === 'tgz' || props.file.name.endsWith('.tar.gz')) {
        parseTar(data, entries)
      } else {
        const innerName = props.file.name.replace(/\.gz$/i, '') || 'file'
        entries.push({
          path: innerName,
          name: innerName.split('/').pop() ?? innerName,
          isDir: false,
          size: data.length,
          getData: async () => data,
        })
      }
    } else {
      throw new Error(`暂不支持 .${ext} 格式（支持：zip、tar、gz、tgz）`)
    }

    flatEntries.value = entries.filter(e => !e.isDir)
    // buildTree 可能耗时，再 yield 一次
    await new Promise(r => setTimeout(r, 0))
    tree.value = buildTree(entries)
  } catch (e) {
    error.value = '解析失败：' + (e as Error).message
  } finally {
    loading.value = false
  }
}

// ── 选中文件预览 ───────────────────────────────────────────────
async function onSelectEntry(entry: ArchiveEntry) {
  if (entry.isDir || !entry.getData) return
  selectedEntry.value = entry
  entryLoading.value = true
  entryError.value = ''
  entryFile.value = null

  try {
    const data = await entry.getData()
    entryFile.value = new File([data], entry.name)
  } catch (e) {
    entryError.value = '读取失败：' + (e as Error).message
  } finally {
    entryLoading.value = false
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

onUnmounted(() => {})

parseArchive()
</script>

<style scoped>
.archive-wrap { display: flex; width: 100%; height: 100%; overflow: hidden; }

.file-tree {
  width: 280px; flex-shrink: 0;
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  background: var(--bg-subtle);
}
.tree-header {
  padding: 10px 14px; border-bottom: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 2px; flex-shrink: 0;
}
.archive-name { font-size: 13px; font-weight: 600; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-count { font-size: 11px; color: var(--text-faint); }
.tree-body { flex: 1; overflow: auto; padding: 6px 0; }

.preview-pane { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-base); }
.pane-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 14px; border-bottom: 1px solid var(--border);
  background: var(--bg-subtle); flex-shrink: 0;
}
.entry-path { font-size: 13px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.entry-size { font-size: 12px; color: var(--text-faint); flex-shrink: 0; margin-left: 8px; }
.pane-body { flex: 1; overflow: auto; }

.empty-pane, .unsupported-entry {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; height: 100%; gap: 12px; color: var(--text-placeholder); font-size: 14px;
}
.status-tip {
  display: flex; align-items: center; justify-content: center;
  height: 100%; width: 100%; color: var(--text-faint); font-size: 14px;
}
.status-tip.error { color: #e53e3e; }
</style>
