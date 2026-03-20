export type FileCategory =
  | 'pdf'
  | 'word'
  | 'excel'
  | 'ppt'
  | 'text'
  | 'markdown'
  | 'yaml'
  | 'properties'
  | 'log'
  | 'sql'
  | 'html'
  | 'xml'
  | 'json'
  | 'image'
  | 'audio'
  | 'video'
  | 'csv'
  | 'java'
  | 'bash'
  | 'dos'
  | 'javascript'
  | 'typescript'
  | 'css'
  | 'vue'
  | 'ofd'
  | 'archive'
  | 'class'
  | 'metafile'
  | 'heic'
  | 'unsupported'

const EXT_MAP: Record<string, FileCategory> = {
  pdf: 'pdf',
  doc: 'word', docx: 'word',
  xls: 'excel', xlsx: 'excel',
  ppt: 'ppt', pptx: 'ppt',
  txt: 'text', out: 'text',
  csv: 'csv',
  java: 'java',
  sh: 'bash',
  bat: 'dos',
  js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript',
  css: 'css',
  vue: 'vue',
  ofd: 'ofd',
  md: 'markdown',
  yml: 'yaml', yaml: 'yaml',
  properties: 'properties',
  log: 'log',
  sql: 'sql',
  html: 'html', htm: 'html',
  xml: 'xml',
  json: 'json',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', svg: 'image', webp: 'image', bmp: 'image',
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio',
  mp4: 'video', webm: 'video', ogv: 'video', mov: 'video', avi: 'video',
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive', tgz: 'archive',
  class: 'class',
  emf: 'metafile', wmf: 'metafile',
  heic: 'heic', heif: 'heic',
}

export function getFileCategory(filename: string): FileCategory {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return EXT_MAP[ext] ?? 'unsupported'
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file, 'UTF-8')
  })
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function createObjectURL(file: File): string {
  return URL.createObjectURL(file)
}
