<template>
  <div class="meta-wrap">
    <div v-if="loading" class="status">加载中...</div>
    <div v-else-if="error" class="status error">{{ error }}</div>
    <div v-else-if="imgUrl" class="canvas-wrap">
      <img :src="imgUrl" style="max-width:100%;max-height:100%;display:block;margin:auto;" />
    </div>
    <div v-else class="canvas-wrap">
      <canvas ref="canvasEl" :style="canvasStyle" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'

const props = defineProps<{ file: File }>()
const loading = ref(true)
const error = ref('')
const canvasEl = ref<HTMLCanvasElement | null>(null)
const imgUrl = ref('')

const canvasStyle = computed(() => ({
  maxWidth: '100%', maxHeight: '100%', display: 'block', margin: 'auto',
}))

// ── 格式检测 ──────────────────────────────────────────────────
// WMF placeable magic: D7 CD C6 9A
// WMF standard: type(2)=1/2 + headerSize(2)=9
// EMF: type(4)=0x00000001 (LE) — 前4字节为 01 00 00 00
function detectFormat(buf: Uint8Array): 'wmf' | 'emf' | 'image' | 'unknown' {
  if (buf.length < 4) return 'unknown'
  // Placeable WMF
  if (buf[0] === 0xD7 && buf[1] === 0xCD && buf[2] === 0xC6 && buf[3] === 0x9A) return 'wmf'
  // EMF: type=1 (4字节 LE)
  if (buf[0] === 0x01 && buf[1] === 0x00 && buf[2] === 0x00 && buf[3] === 0x00) return 'emf'
  // Standard WMF
  if ((buf[0] === 0x01 || buf[0] === 0x02) && buf[1] === 0x00 && buf[2] === 0x09 && buf[3] === 0x00) return 'wmf'
  // 常见图片格式 magic bytes
  if (buf[0] === 0xFF && buf[1] === 0xD8) return 'image'  // JPEG
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image'  // PNG
  if (buf[0] === 0x47 && buf[1] === 0x49) return 'image'  // GIF
  if (buf[0] === 0x42 && buf[1] === 0x4D) return 'image'  // BMP
  return 'unknown'
}

// ── WMF 渲染（手写解析器，不依赖 wmf 库）────────────────────
// 参考 MS-WMF 规范，覆盖常见绘图记录
async function renderWmf(buf: Uint8Array, canvas: HTMLCanvasElement) {
  const dv  = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const u16 = (o: number) => dv.getUint16(o, true)
  const i16 = (o: number) => dv.getInt16(o, true)
  const u32 = (o: number) => dv.getUint32(o, true)

  let dataStart = 0
  let canvasW = 400, canvasH = 300

  // Placeable WMF header (22 bytes): magic+handle+left+top+right+bottom+inch+reserved+checksum
  if (buf[0] === 0xD7 && buf[1] === 0xCD && buf[2] === 0xC6 && buf[3] === 0x9A) {
    const left = i16(6), top = i16(8), right = i16(10), bottom = i16(12)
    const inch = u16(14) || 1440
    const pxW = Math.round(Math.abs(right - left) / inch * 96)
    const pxH = Math.round(Math.abs(bottom - top) / inch * 96)
    if (pxW > 0 && pxW <= 4096) canvasW = pxW
    if (pxH > 0 && pxH <= 4096) canvasH = pxH
    dataStart = 22
  } else {
    // Standard WMF: 预扫描找 META_SETWINDOWEXT 来确定宽高比，然后缩放到合理尺寸
    let scanOff = 18
    while (scanOff + 6 <= buf.byteLength) {
      const sz = u32(scanOff) * 2, fn2 = u16(scanOff + 4)
      if (sz < 6) break
      if (fn2 === 0x020C && scanOff + 10 <= buf.byteLength) {
        const extY = Math.abs(i16(scanOff + 6)), extX = Math.abs(i16(scanOff + 8))
        if (extX > 0 && extY > 0) {
          // 保持宽高比，宽度固定 800px
          canvasW = 800
          canvasH = Math.round(800 * extY / extX)
          if (canvasH > 4096) { canvasH = 4096; canvasW = Math.round(4096 * extX / extY) }
        }
        break
      }
      if (fn2 === 0x0000 || scanOff + sz > buf.byteLength) break
      scanOff += sz
    }
  }

  canvas.width = canvasW; canvas.height = canvasH
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvasW, canvasH)

  // 坐标系：WMF 使用逻辑坐标，由 META_SETWINDOWORG/EXT 定义
  // winExtY < 0 表示 Y 轴向上（数学坐标系），需要翻转到 canvas 坐标系
  let winOrgX = 0, winOrgY = 0, winExtX = canvasW, winExtY = canvasH
  const tx = (x: number) => (x - winOrgX) / Math.abs(winExtX || 1) * canvasW
  const ty = (y: number) => winExtY < 0
    ? canvasH - (y - winOrgY) / Math.abs(winExtY) * canvasH
    : (y - winOrgY) / (winExtY || 1) * canvasH
  const sw = (n: number) => Math.abs(n / (winExtX || 1) * canvasW)
  const sh = (n: number) => Math.abs(n / (winExtY || 1) * canvasH)

  // GDI 对象表
  const objs: any[] = []
  const setObj = (obj: any) => {
    const idx = objs.findIndex(o => o === null)
    if (idx >= 0) objs[idx] = obj; else objs.push(obj)
  }

  let pen   = { style: 0, width: 1, r: 0, g: 0, b: 0 }
  let brush = { style: 0, r: 0, g: 0, b: 0 }
  let textColor = { r: 0, g: 0, b: 0 }
  let font  = { height: 14, italic: false, weight: 400, name: 'sans-serif', angle: 0 }
  let curX = 0, curY = 0

  const applyPen = () => {
    ctx.strokeStyle = pen.style === 5 ? 'rgba(0,0,0,0)' : `rgb(${pen.r},${pen.g},${pen.b})`
    ctx.lineWidth = Math.max(sw(pen.width), 1)
  }
  const applyBrush = () => {
    ctx.fillStyle = brush.style === 1 ? 'rgba(0,0,0,0)' : `rgb(${brush.r},${brush.g},${brush.b})`
  }

  let off = dataStart
  // 跳过 WMF file header (18 bytes = 9 words)
  off += 18

  while (off + 6 <= buf.byteLength) {
    const recSize = u32(off) * 2  // size in words → bytes
    const fn      = u16(off + 4)
    if (recSize < 6 || off + recSize > buf.byteLength) break
    if (fn === 0x0000) break  // META_EOF

    const p = off + 6  // params start

    try {
    switch (fn) {
      // ── 窗口坐标 ──────────────────────────────────────────
      case 0x020B: winOrgY = i16(p); winOrgX = i16(p+2); break  // META_SETWINDOWORG
      case 0x020C: winExtY = i16(p); winExtX = i16(p+2); break  // META_SETWINDOWEXT

      // ── 画笔 ──────────────────────────────────────────────
      case 0x02FA: { // META_CREATEPENINDIRECT: style(2)+width.x(2)+width.y(2)+colorref(4)
        const color = u32(p + 4)
        setObj({ kind:'pen', style: u16(p), width: u16(p+2),
          r: color & 0xFF, g: (color>>8) & 0xFF, b: (color>>16) & 0xFF })
        break
      }
      // ── 画刷 ──────────────────────────────────────────────
      case 0x02FC: { // META_CREATEBRUSHINDIRECT: style(2)+colorref(4)+hatch(2)
        const color = u32(p + 2)
        setObj({ kind:'brush', style: u16(p),
          r: color & 0xFF, g: (color>>8) & 0xFF, b: (color>>16) & 0xFF })
        break
      }
      case 0x00F8: { // META_CREATEBRUSH (solid)
        const color = u32(p + 2)
        setObj({ kind:'brush', style: 0,
          r: color & 0xFF, g: (color>>8) & 0xFF, b: (color>>16) & 0xFF })
        break
      }
      // ── 字体 ──────────────────────────────────────────────
      case 0x02FB: { // META_CREATEFONTINDIRECT (LOGFONT)
        // lfHeight(2)+lfWidth(2)+lfEscapement(2)+lfOrientation(2)+lfWeight(2)+lfItalic(1)+...+lfFaceName(32)
        const h = i16(p)
        const escapement = i16(p + 4)  // 0.1度，顺时针
        const weight = u16(p + 8)
        const italic = buf[p + 10] !== 0
        let name = ''
        for (let i = 0; i < 32 && p+18+i < buf.byteLength && buf[p+18+i] !== 0; i++)
          name += String.fromCharCode(buf[p+18+i])
        setObj({ kind:'font', height: Math.abs(h) || 14, weight, italic,
          angle: escapement / 10, name: name || 'sans-serif' })
        break
      }
      // ── 选择/删除对象 ──────────────────────────────────────
      case 0x012D: { // META_SELECTOBJECT
        const idx = u16(p)
        const obj = objs[idx]
        if (obj?.kind === 'pen')   pen   = obj
        if (obj?.kind === 'brush') brush = obj
        if (obj?.kind === 'font')  font  = obj
        break
      }
      case 0x01F0: objs[u16(p)] = null; break  // META_DELETEOBJECT

      // ── 颜色/模式 ──────────────────────────────────────────
      case 0x0209: { const c = u32(p); textColor = { r: c&0xFF, g:(c>>8)&0xFF, b:(c>>16)&0xFF }; break } // META_SETTEXTCOLOR
      case 0x0102: break  // META_SETBKMODE — ignore

      // ── 基本图形 ──────────────────────────────────────────
      case 0x041B: { // META_RECTANGLE: bottom,right,top,left
        applyPen(); applyBrush()
        const [bot,r,top,l] = [i16(p),i16(p+2),i16(p+4),i16(p+6)]
        ctx.beginPath(); ctx.rect(tx(l),ty(top),tx(r)-tx(l),ty(bot)-ty(top))
        ctx.fill(); ctx.stroke(); break
      }
      case 0x0418: { // META_ELLIPSE: bottom,right,top,left
        applyPen(); applyBrush()
        const [bot,r,top,l] = [i16(p),i16(p+2),i16(p+4),i16(p+6)]
        const cx2=(tx(l)+tx(r))/2, cy2=(ty(top)+ty(bot))/2
        ctx.beginPath(); ctx.ellipse(cx2,cy2,Math.abs(tx(r)-tx(l))/2,Math.abs(ty(bot)-ty(top))/2,0,0,Math.PI*2)
        ctx.fill(); ctx.stroke(); break
      }
      case 0x0214: { // META_MOVETO: y,x  (PointS is x,y but params are pushed y first)
        curY = i16(p); curX = i16(p+2); break
      }
      case 0x0213: { // META_LINETO: y,x
        applyPen()
        const ny = i16(p), nx = i16(p+2)
        ctx.beginPath(); ctx.moveTo(tx(curX),ty(curY)); ctx.lineTo(tx(nx),ty(ny)); ctx.stroke()
        curX=nx; curY=ny; break
      }
      case 0x0325: { // META_POLYLINE: count, PointS(x,y)...
        applyPen()
        const cnt = u16(p)
        ctx.beginPath()
        for (let i = 0; i < cnt; i++) {
          const px2 = tx(i16(p+2+i*4)), py2 = ty(i16(p+2+i*4+2))
          i === 0 ? ctx.moveTo(px2,py2) : ctx.lineTo(px2,py2)
        }
        ctx.stroke(); break
      }
      case 0x0324: { // META_POLYGON: count, PointS(x,y)...
        applyPen(); applyBrush()
        const cnt = u16(p)
        ctx.beginPath()
        for (let i = 0; i < cnt; i++) {
          const px2 = tx(i16(p+2+i*4)), py2 = ty(i16(p+2+i*4+2))
          i === 0 ? ctx.moveTo(px2,py2) : ctx.lineTo(px2,py2)
        }
        ctx.closePath(); ctx.fill(); ctx.stroke(); break
      }
      case 0x0538: { // META_POLYPOLYLINE: numPolys, counts[], PointS(x,y)...
        applyPen()
        const numPolys = u16(p)
        let countsOff = p + 2
        let ptsOff = countsOff + numPolys * 2
        for (let poly = 0; poly < numPolys; poly++) {
          const cnt = u16(countsOff + poly * 2)
          ctx.beginPath()
          for (let i = 0; i < cnt; i++) {
            const px2 = tx(i16(ptsOff)), py2 = ty(i16(ptsOff + 2))
            i === 0 ? ctx.moveTo(px2, py2) : ctx.lineTo(px2, py2)
            ptsOff += 4
          }
          ctx.stroke()
        }
        break
      }
      // ── 文字 ──────────────────────────────────────────────
      case 0x0A32: { // META_EXTTEXTOUT: y,x,count,options,[cliprect(8)],string
        const ey = i16(p), ex = i16(p+2), cnt = u16(p+4)
        const opts = u16(p+6)
        const strOff = p + 8 + ((opts & 0x06) ? 8 : 0)
        let text = ''
        for (let i = 0; i < cnt && strOff+i < buf.byteLength; i++)
          text += String.fromCharCode(buf[strOff+i])
        const fs = Math.max(sh(font.height), 8)
        const rad = font.angle * Math.PI / 180  // WMF escapement 单位 0.1度
        ctx.save()
        ctx.translate(tx(ex), ty(ey))
        if (rad) ctx.rotate(rad)
        ctx.fillStyle = `rgb(${textColor.r},${textColor.g},${textColor.b})`
        ctx.font = `${font.italic ? 'italic ' : ''}${font.weight >= 700 ? 'bold ' : ''}${fs}px ${font.name}`
        ctx.fillText(text, 0, 0)
        ctx.restore()
        break
      }
      case 0x0521: { // META_TEXTOUT: count, string(padded), y, x
        const cnt = u16(p)
        let text = ''
        for (let i = 0; i < cnt && p+2+i < buf.byteLength; i++)
          text += String.fromCharCode(buf[p+2+i])
        const strEnd = p + 2 + cnt + (cnt % 2)  // 字符串按 word 对齐
        const ey = i16(strEnd), ex = i16(strEnd + 2)
        const fs = Math.max(sh(font.height), 8)
        const rad = font.angle * Math.PI / 180
        ctx.save()
        ctx.translate(tx(ex), ty(ey))
        if (rad) ctx.rotate(rad)
        ctx.fillStyle = `rgb(${textColor.r},${textColor.g},${textColor.b})`
        ctx.font = `${font.italic ? 'italic ' : ''}${font.weight >= 700 ? 'bold ' : ''}${fs}px ${font.name}`
        ctx.fillText(text, 0, 0)
        ctx.restore()
        break
      }
      // ── META_ESCAPE：跳过，不报错 ──────────────────────────
      case 0x0626: break  // META_ESCAPE — ignore all escape records

      // ── 位图 ──────────────────────────────────────────────
      case 0x0940:   // META_DIBBITBLT
      case 0x0B41: { // META_DIBSTRETCHBLT
        // params: rasterOp(4)+srcY(2)+srcX(2)+srcH(2)+srcW(2)+dstY(2)+dstX(2)+dstH(2)+dstW(2)+DIB
        const dstY=i16(p+12),dstX=i16(p+14),dstH=i16(p+8),dstW=i16(p+10)
        const dibOff = fn===0x0940 ? p+16 : p+18
        if (dibOff < off+recSize) {
          const dib = buf.slice(dibOff, off+recSize)
          const totalSize = 14 + dib.length
          const bmp = new Uint8Array(totalSize)
          bmp[0]=0x42; bmp[1]=0x4D
          // file size (4 bytes LE)
          bmp[2]=totalSize&0xFF; bmp[3]=(totalSize>>8)&0xFF; bmp[4]=(totalSize>>16)&0xFF; bmp[5]=(totalSize>>24)&0xFF
          // pixel data offset = 14 + BITMAPINFOHEADER(40) = 54
          const pxO = 14 + 40
          bmp[10]=pxO&0xFF; bmp[11]=(pxO>>8)&0xFF
          bmp.set(dib, 14)
          const url = URL.createObjectURL(new Blob([bmp], {type:'image/bmp'}))
          await new Promise<void>(res => {
            const img = new Image()
            img.onload = () => { ctx.drawImage(img,tx(dstX),ty(dstY),sw(dstW),sh(dstH)); URL.revokeObjectURL(url); res() }
            img.onerror = () => { URL.revokeObjectURL(url); res() }
            img.src = url
          })
        }
        break
      }
    }
    } catch { /* skip malformed record */ }
    off += recSize
  }
}

// ── EMF 渲染（手写解析器，覆盖 MS-EMF 常见绘图记录）─────────
function renderEmf(buf: Uint8Array, canvas: HTMLCanvasElement) {
  const v   = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const u32 = (o: number) => v.getUint32(o, true)
  const i32 = (o: number) => v.getInt32(o, true)
  const u16 = (o: number) => v.getUint16(o, true)
  const i16 = (o: number) => v.getInt16(o, true)

  // EMR_HEADER: rclBounds(16) at offset 8, rclFrame(16) at offset 24
  const bL = i32(8), bT = i32(12), bR = i32(16), bB = i32(20)
  const logW = Math.abs(bR - bL) || 400
  const logH = Math.abs(bB - bT) || 300
  // 缩放到合理的 canvas 尺寸（最大 1600px 宽）
  const scale = Math.min(1600 / logW, 1200 / logH, 1)
  const canvasW = Math.round(logW * scale) || 800
  const canvasH = Math.round(logH * scale) || 600
  canvas.width = canvasW; canvas.height = canvasH

  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvasW, canvasH)

  const tx = (x: number) => (x - bL) * scale
  const ty = (y: number) => (y - bT) * scale
  const sc = (n: number) => n * scale

  // 16-bit 坐标版本（POLYBEZIER16 等）
  const tx16 = (x: number) => tx(x)
  const ty16 = (y: number) => ty(y)

  const objs = new Map<number, any>()
  let pen   = { style: 0, width: 1, color: '#000' }
  let brush = { style: 0, color: '#fff', style_id: 0 }
  let textColor = '#000'
  let cx = 0, cy = 0

  const rgb = (o: number) => `rgb(${buf[o]},${buf[o+1]},${buf[o+2]})`
  const applyPen   = () => {
    ctx.strokeStyle = pen.style === 5 ? 'transparent' : pen.color
    ctx.lineWidth = Math.max(sc(pen.width), 0.5)
  }
  const applyBrush = () => {
    ctx.fillStyle = brush.style_id === 1 ? 'transparent' : brush.color
  }

  // 32-bit 点数组
  const pts32 = (o: number, n: number): [number,number][] =>
    Array.from({ length: n }, (_, i) => [i32(o + i*8), i32(o + i*8 + 4)])
  // 16-bit 点数组
  const pts16 = (o: number, n: number): [number,number][] =>
    Array.from({ length: n }, (_, i) => [i16(o + i*4), i16(o + i*4 + 2)])

  let off = 0
  while (off < buf.byteLength - 8) {
    const type = u32(off), size = u32(off + 4)
    if (size < 8 || off + size > buf.byteLength) break

    try {
    switch (type) {
      case 0x01: break  // EMR_HEADER
      case 0x0E: off = buf.byteLength; continue  // EMR_EOF

      // ── 对象创建 ──────────────────────────────────────────
      case 0x26: { // EMR_CREATEPEN: ihPen(4)+lopn.style(4)+lopn.width.x(4)+lopn.width.y(4)+lopn.color(4)
        const ih = u32(off + 8)
        objs.set(ih, { kind:'pen', style: u32(off+12), width: i32(off+16), color: rgb(off+24) })
        break
      }
      case 0x40: { // EMR_EXTCREATEPEN
        const ih = u32(off + 8)
        // offPenData(4)+cbPenData(4) at off+12, then EXTLOGPEN at off+20
        const style = u32(off + 20), width = u32(off + 24)
        const color = rgb(off + 32)
        objs.set(ih, { kind:'pen', style: style & 0xFF, width, color })
        break
      }
      case 0x27: { // EMR_CREATEBRUSHINDIRECT: ihBrush(4)+lbStyle(4)+lbColor(4)+lbHatch(4)
        const ih = u32(off + 8)
        objs.set(ih, { kind:'brush', style_id: u32(off+12), color: rgb(off+16) })
        break
      }
      case 0x3E: { // EMR_CREATEMONOBRUSH
        const ih = u32(off + 8)
        objs.set(ih, { kind:'brush', style_id: 0, color: '#000' })
        break
      }
      case 0x33: break  // EMR_SAVEDC
      case 0x22: break  // EMR_SETTEXTALIGN
      case 0x12: break  // EMR_SETBKMODE
      case 0x13: break  // EMR_SETPOLYFILLMODE — ignore

      case 0x25: { // EMR_SELECTOBJECT
        const ih = u32(off + 8)
        const o = objs.get(ih)
        if (o?.kind === 'pen')   pen   = o
        if (o?.kind === 'brush') brush = o
        if (ih === 0x80000007) brush = { style_id:1, color:'transparent' }  // NULL_BRUSH
        if (ih === 0x80000008) pen   = { style:5, width:0, color:'transparent' }  // NULL_PEN
        break
      }
      case 0x28: objs.delete(u32(off + 8)); break  // EMR_DELETEOBJECT

      // ── 坐标变换 ──────────────────────────────────────────
      case 0x24: { // EMR_MODIFYWORLDTRANSFORM — 忽略，保持 canvas 默认变换
        break
      }

      // ── 颜色 ──────────────────────────────────────────────
      case 0x18: { // EMR_SETTEXTCOLOR
        textColor = rgb(off + 8); break
      }
      case 0x1B: cx = i32(off+8); cy = i32(off+12); break  // EMR_MOVETOEX

      case 0x03: { // EMR_POLYGON
        applyPen(); applyBrush()
        const p = pts32(off+28, u32(off+24))
        if (!p.length) break
        ctx.beginPath(); ctx.moveTo(tx(p[0][0]), ty(p[0][1]))
        p.slice(1).forEach(([x,y]) => ctx.lineTo(tx(x), ty(y)))
        ctx.closePath(); ctx.fill(); ctx.stroke(); break
      }
      case 0x04: { // EMR_POLYLINE
        applyPen()
        const p = pts32(off+28, u32(off+24))
        if (!p.length) break
        ctx.beginPath(); ctx.moveTo(tx(p[0][0]), ty(p[0][1]))
        p.slice(1).forEach(([x,y]) => ctx.lineTo(tx(x), ty(y)))
        ctx.stroke(); break
      }
      case 0x02: { // EMR_POLYBEZIER: bounds(16)+count(4)+pts(32-bit)
        applyPen()
        const cnt = u32(off + 24)
        const p = pts32(off + 28, cnt)
        if (p.length < 4) break
        ctx.beginPath(); ctx.moveTo(tx(p[0][0]), ty(p[0][1]))
        for (let i = 1; i + 2 < p.length; i += 3)
          ctx.bezierCurveTo(tx(p[i][0]),ty(p[i][1]),tx(p[i+1][0]),ty(p[i+1][1]),tx(p[i+2][0]),ty(p[i+2][1]))
        ctx.stroke(); break
      }

      // ── 16-bit 坐标系列（更常见）──────────────────────────
      case 0x36: { // EMR_POLYBEZIER16: bounds(16)+count(4)+pts(16-bit)
        applyPen()
        const cnt = u32(off + 24)
        const p = pts16(off + 28, cnt)
        if (p.length < 4) break
        ctx.beginPath(); ctx.moveTo(tx16(p[0][0]), ty16(p[0][1]))
        for (let i = 1; i + 2 < p.length; i += 3)
          ctx.bezierCurveTo(tx16(p[i][0]),ty16(p[i][1]),tx16(p[i+1][0]),ty16(p[i+1][1]),tx16(p[i+2][0]),ty16(p[i+2][1]))
        ctx.stroke(); break
      }
      case 0x37: { // EMR_POLYGON16
        applyPen(); applyBrush()
        const cnt = u32(off + 24)
        const p = pts16(off + 28, cnt)
        if (!p.length) break
        ctx.beginPath(); ctx.moveTo(tx16(p[0][0]), ty16(p[0][1]))
        p.slice(1).forEach(([x,y]) => ctx.lineTo(tx16(x), ty16(y)))
        ctx.closePath(); ctx.fill(); ctx.stroke(); break
      }
      case 0x38: { // EMR_POLYLINE16
        applyPen()
        const cnt = u32(off + 24)
        const p = pts16(off + 28, cnt)
        if (!p.length) break
        ctx.beginPath(); ctx.moveTo(tx16(p[0][0]), ty16(p[0][1]))
        p.slice(1).forEach(([x,y]) => ctx.lineTo(tx16(x), ty16(y)))
        ctx.stroke(); break
      }
      case 0x39: { // EMR_POLYBEZIERTO16: 从当前点开始的贝塞尔
        applyPen()
        const cnt = u32(off + 24)
        const p = pts16(off + 28, cnt)
        ctx.beginPath(); ctx.moveTo(tx(cx), ty(cy))
        for (let i = 0; i + 2 < p.length; i += 3)
          ctx.bezierCurveTo(tx16(p[i][0]),ty16(p[i][1]),tx16(p[i+1][0]),ty16(p[i+1][1]),tx16(p[i+2][0]),ty16(p[i+2][1]))
        ctx.stroke()
        if (p.length >= 3) { cx = p[p.length-1][0]; cy = p[p.length-1][1] }
        break
      }
      case 0x3A: { // EMR_POLYLINETO16
        applyPen()
        const cnt = u32(off + 24)
        const p = pts16(off + 28, cnt)
        ctx.beginPath(); ctx.moveTo(tx(cx), ty(cy))
        p.forEach(([x,y]) => ctx.lineTo(tx16(x), ty16(y)))
        ctx.stroke()
        if (p.length) { cx = p[p.length-1][0]; cy = p[p.length-1][1] }
        break
      }
      case 0x3B: { // EMR_POLYPOLYLINE16: bounds(16)+nPolys(4)+cPts(4)+aPolyCounts(nPolys*4)+pts
        applyPen()
        const nPolys = u32(off + 24), cPts = u32(off + 28)
        let countsOff = off + 32
        let ptsOff = countsOff + nPolys * 4
        for (let poly = 0; poly < nPolys; poly++) {
          const cnt = u32(countsOff + poly * 4)
          const p = pts16(ptsOff, cnt)
          ptsOff += cnt * 4
          if (!p.length) continue
          ctx.beginPath(); ctx.moveTo(tx16(p[0][0]), ty16(p[0][1]))
          p.slice(1).forEach(([x,y]) => ctx.lineTo(tx16(x), ty16(y)))
          ctx.stroke()
        }
        break
      }
      case 0x3C: { // EMR_POLYPOLYGON16
        applyPen(); applyBrush()
        const nPolys = u32(off + 24), cPts = u32(off + 28)
        let countsOff = off + 32
        let ptsOff = countsOff + nPolys * 4
        for (let poly = 0; poly < nPolys; poly++) {
          const cnt = u32(countsOff + poly * 4)
          const p = pts16(ptsOff, cnt)
          ptsOff += cnt * 4
          if (!p.length) continue
          ctx.beginPath(); ctx.moveTo(tx16(p[0][0]), ty16(p[0][1]))
          p.slice(1).forEach(([x,y]) => ctx.lineTo(tx16(x), ty16(y)))
          ctx.closePath(); ctx.fill(); ctx.stroke()
        }
        break
      }
      case 0x3D: { // EMR_POLYDRAW16: bounds(16)+count(4)+pts+types
        applyPen()
        const cnt = u32(off + 24)
        const p = pts16(off + 28, cnt)
        const typesOff = off + 28 + cnt * 4
        ctx.beginPath()
        for (let i = 0; i < p.length && typesOff + i < buf.byteLength; i++) {
          const t2 = buf[typesOff + i]
          const px2 = tx16(p[i][0]), py2 = ty16(p[i][1])
          if (t2 === 6) ctx.moveTo(px2, py2)       // PT_MOVETO
          else if (t2 === 2 || t2 === 3) ctx.lineTo(px2, py2)  // PT_LINETO
          else if (t2 === 4 || t2 === 5) {          // PT_BEZIERTO (need 3 pts)
            if (i + 2 < p.length) {
              ctx.bezierCurveTo(px2, py2, tx16(p[i+1][0]), ty16(p[i+1][1]), tx16(p[i+2][0]), ty16(p[i+2][1]))
              i += 2
            }
          }
        }
        ctx.stroke(); break
      }

      // ── 文字 ──────────────────────────────────────────────
      case 0x34: // EMR_EXTTEXTOUTA
      case 0x35: { // EMR_EXTTEXTOUTW
        // EMR_EXTTEXTOUT: off+8=bounds(16), off+24=iGraphicsMode(4), off+28=exScale(4), off+32=eyScale(4)
        // EmrText at off+36: ptlReference(8)+nChars(4)+offString(4)+...
        const ex = i32(off+36), ey = i32(off+40)
        const len = u32(off+44), strOff = u32(off+48)
        let text = ''
        if (type === 0x35) {
          for (let i = 0; i < len && off+strOff+i*2+1 < buf.byteLength; i++)
            text += String.fromCharCode(u16(off + strOff + i*2))
        } else {
          for (let i = 0; i < len && off+strOff+i < buf.byteLength; i++)
            text += String.fromCharCode(buf[off + strOff + i])
        }
        ctx.fillStyle = textColor
        ctx.font = `${Math.max(sc(14), 10)}px sans-serif`
        ctx.fillText(text, tx(ex), ty(ey)); break
      }

      // ── 位图 ──────────────────────────────────────────────
      case 0x4C:  // EMR_BITBLT
      case 0x50: { // EMR_STRETCHDIBITS
        const bmiOff  = u32(off + 0x48), bmiLen  = u32(off + 0x4C)
        const bitsOff = u32(off + 0x50), bitsLen = u32(off + 0x54)
        if (bmiLen > 0 && bitsLen > 0) {
          const bmi  = buf.slice(off + bmiOff, off + bmiOff  + bmiLen)
          const bits = buf.slice(off + bitsOff, off + bitsOff + bitsLen)
          const bmp  = new Uint8Array(14 + bmi.length + bits.length)
          bmp[0] = 0x42; bmp[1] = 0x4D
          const pxOff = 14 + bmi.length
          bmp[10] = pxOff & 0xFF; bmp[11] = (pxOff >> 8) & 0xFF
          bmp.set(bmi, 14); bmp.set(bits, pxOff)
          const url = URL.createObjectURL(new Blob([bmp], { type: 'image/bmp' }))
          const img = new Image()
          const snapOff = off
          img.onload = () => {
            ctx.drawImage(img, tx(i32(snapOff+8)), ty(i32(snapOff+12)), sc(i32(snapOff+16)), sc(i32(snapOff+20)))
            URL.revokeObjectURL(url)
          }
          img.src = url
        }
        break
      }
    }
    } catch { /* skip malformed record */ }
    off += size
  }
}

onMounted(async () => {
  try {
    const ab  = await props.file.arrayBuffer()
    const buf = new Uint8Array(ab)
    const fmt = detectFormat(buf)
    if (fmt === 'unknown') { error.value = '无法识别的文件格式'; return }

    if (fmt === 'image') {
      imgUrl.value = URL.createObjectURL(props.file)
      loading.value = false
      return
    }

    // 先关闭 loading，让 Vue 渲染出 canvas 元素，再操作它
    loading.value = false
    await nextTick()

    const canvas = canvasEl.value
    if (!canvas) { error.value = '渲染容器初始化失败'; return }

    if (fmt === 'wmf') await renderWmf(buf, canvas)
    else renderEmf(buf, canvas)
  } catch (e) {
    error.value = '渲染失败：' + ((e as Error).message ?? String(e))
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.meta-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; overflow: auto; background: var(--bg-muted); }
.canvas-wrap { flex: 1; display: flex; align-items: center; justify-content: center; padding: 16px; }
.status { padding: 32px; text-align: center; color: var(--text-muted); }
.status.error { color: #e53e3e; }
</style>
