<template>
  <div class="class-wrap">
    <div v-if="error" class="status-tip error">{{ error }}</div>
    <div v-else-if="!output" class="status-tip">解析中...</div>
    <pre v-else class="javap-output">{{ output }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{ file: File }>()
const output = ref('')
const error  = ref('')

// ── JVM opcode 表（助记符 + 操作数字节数） ─────────────────────
// [助记符, 操作数字节数] -1 表示变长指令需特殊处理
const OPCODES: Record<number, [string, number]> = {
  0x00:['nop',0],         0x01:['aconst_null',0],
  0x02:['iconst_m1',0],   0x03:['iconst_0',0],    0x04:['iconst_1',0],
  0x05:['iconst_2',0],    0x06:['iconst_3',0],    0x07:['iconst_4',0],
  0x08:['iconst_5',0],    0x09:['lconst_0',0],    0x0a:['lconst_1',0],
  0x0b:['fconst_0',0],    0x0c:['fconst_1',0],    0x0d:['fconst_2',0],
  0x0e:['dconst_0',0],    0x0f:['dconst_1',0],
  0x10:['bipush',1],      0x11:['sipush',2],
  0x12:['ldc',1],         0x13:['ldc_w',2],       0x14:['ldc2_w',2],
  0x15:['iload',1],       0x16:['lload',1],       0x17:['fload',1],
  0x18:['dload',1],       0x19:['aload',1],
  0x1a:['iload_0',0],     0x1b:['iload_1',0],     0x1c:['iload_2',0],     0x1d:['iload_3',0],
  0x1e:['lload_0',0],     0x1f:['lload_1',0],     0x20:['lload_2',0],     0x21:['lload_3',0],
  0x22:['fload_0',0],     0x23:['fload_1',0],     0x24:['fload_2',0],     0x25:['fload_3',0],
  0x26:['dload_0',0],     0x27:['dload_1',0],     0x28:['dload_2',0],     0x29:['dload_3',0],
  0x2a:['aload_0',0],     0x2b:['aload_1',0],     0x2c:['aload_2',0],     0x2d:['aload_3',0],
  0x2e:['iaload',0],      0x2f:['laload',0],      0x30:['faload',0],      0x31:['daload',0],
  0x32:['aaload',0],      0x33:['baload',0],      0x34:['caload',0],      0x35:['saload',0],
  0x36:['istore',1],      0x37:['lstore',1],      0x38:['fstore',1],      0x39:['dstore',1],
  0x3a:['astore',1],
  0x3b:['istore_0',0],    0x3c:['istore_1',0],    0x3d:['istore_2',0],    0x3e:['istore_3',0],
  0x3f:['lstore_0',0],    0x40:['lstore_1',0],    0x41:['lstore_2',0],    0x42:['lstore_3',0],
  0x43:['fstore_0',0],    0x44:['fstore_1',0],    0x45:['fstore_2',0],    0x46:['fstore_3',0],
  0x47:['dstore_0',0],    0x48:['dstore_1',0],    0x49:['dstore_2',0],    0x4a:['dstore_3',0],
  0x4b:['astore_0',0],    0x4c:['astore_1',0],    0x4d:['astore_2',0],    0x4e:['astore_3',0],
  0x4f:['iastore',0],     0x50:['lastore',0],     0x51:['fastore',0],     0x52:['dastore',0],
  0x53:['aastore',0],     0x54:['bastore',0],     0x55:['castore',0],     0x56:['sastore',0],
  0x57:['pop',0],         0x58:['pop2',0],        0x59:['dup',0],         0x5a:['dup_x1',0],
  0x5b:['dup_x2',0],      0x5c:['dup2',0],        0x5d:['dup2_x1',0],     0x5e:['dup2_x2',0],
  0x5f:['swap',0],
  0x60:['iadd',0],0x61:['ladd',0],0x62:['fadd',0],0x63:['dadd',0],
  0x64:['isub',0],0x65:['lsub',0],0x66:['fsub',0],0x67:['dsub',0],
  0x68:['imul',0],0x69:['lmul',0],0x6a:['fmul',0],0x6b:['dmul',0],
  0x6c:['idiv',0],0x6d:['ldiv',0],0x6e:['fdiv',0],0x6f:['ddiv',0],
  0x70:['irem',0],0x71:['lrem',0],0x72:['frem',0],0x73:['drem',0],
  0x74:['ineg',0],0x75:['lneg',0],0x76:['fneg',0],0x77:['dneg',0],
  0x78:['ishl',0],0x79:['lshl',0],0x7a:['ishr',0],0x7b:['lshr',0],
  0x7c:['iushr',0],0x7d:['lushr',0],
  0x7e:['iand',0],0x7f:['land',0],0x80:['ior',0],0x81:['lor',0],
  0x82:['ixor',0],0x83:['lxor',0],
  0x84:['iinc',2],
  0x85:['i2l',0],0x86:['i2f',0],0x87:['i2d',0],0x88:['l2i',0],0x89:['l2f',0],
  0x8a:['l2d',0],0x8b:['f2i',0],0x8c:['f2l',0],0x8d:['f2d',0],0x8e:['d2i',0],
  0x8f:['d2l',0],0x90:['d2f',0],0x91:['i2b',0],0x92:['i2c',0],0x93:['i2s',0],
  0x94:['lcmp',0],0x95:['fcmpl',0],0x96:['fcmpg',0],0x97:['dcmpl',0],0x98:['dcmpg',0],
  0x99:['ifeq',2],0x9a:['ifne',2],0x9b:['iflt',2],0x9c:['ifge',2],
  0x9d:['ifgt',2],0x9e:['ifle',2],
  0x9f:['if_icmpeq',2],0xa0:['if_icmpne',2],0xa1:['if_icmplt',2],
  0xa2:['if_icmpge',2],0xa3:['if_icmpgt',2],0xa4:['if_icmple',2],
  0xa5:['if_acmpeq',2],0xa6:['if_acmpne',2],
  0xa7:['goto',2],        0xa8:['jsr',2],         0xa9:['ret',1],
  0xaa:['tableswitch',-1],0xab:['lookupswitch',-1],
  0xac:['ireturn',0],0xad:['lreturn',0],0xae:['freturn',0],
  0xaf:['dreturn',0],0xb0:['areturn',0],0xb1:['return',0],
  0xb2:['getstatic',2],   0xb3:['putstatic',2],
  0xb4:['getfield',2],    0xb5:['putfield',2],
  0xb6:['invokevirtual',2],0xb7:['invokespecial',2],0xb8:['invokestatic',2],
  0xb9:['invokeinterface',4],0xba:['invokedynamic',4],
  0xbb:['new',2],         0xbc:['newarray',1],    0xbd:['anewarray',2],
  0xbe:['arraylength',0], 0xbf:['athrow',0],      0xc0:['checkcast',2],
  0xc1:['instanceof',2],  0xc2:['monitorenter',0],0xc3:['monitorexit',0],
  0xc4:['wide',-1],       0xc5:['multianewarray',3],
  0xc6:['ifnull',2],      0xc7:['ifnonnull',2],
  0xc8:['goto_w',4],      0xc9:['jsr_w',4],
}

// ── 常量 ──────────────────────────────────────────────
const ACC_PUBLIC       = 0x0001
const ACC_PRIVATE      = 0x0002
const ACC_PROTECTED    = 0x0004
const ACC_STATIC       = 0x0008
const ACC_FINAL        = 0x0010
const ACC_SYNCHRONIZED = 0x0020
const ACC_VOLATILE     = 0x0040
const ACC_TRANSIENT    = 0x0080
const ACC_NATIVE       = 0x0100
const ACC_INTERFACE    = 0x0200
const ACC_ABSTRACT     = 0x0400
const ACC_ENUM         = 0x4000
const ACC_ANNOTATION   = 0x2000
const ACC_SYNTHETIC    = 0x1000

// ── 解析器 ────────────────────────────────────────────
function parseClass(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  const view  = new DataView(buf)
  const size  = bytes.length
  let off = 0

  const u1   = () => { if (off+1>size) throw new Error(`越界@${off}`); return view.getUint8(off++)  }
  const u2   = () => { if (off+2>size) throw new Error(`越界@${off}`); const v=view.getUint16(off); off+=2; return v }
  const u4   = () => { if (off+4>size) throw new Error(`越界@${off}`); const v=view.getUint32(off); off+=4; return v }
  const skip = (n: number) => { if (off+n>size) throw new Error(`越界@${off}`); off+=n }
  const i2   = () => { const v=view.getInt16(off); off+=2; return v }  // 有符号 short，用于跳转偏移

  if (u4() !== 0xCAFEBABE) throw new Error('不是有效的 .class 文件（魔数校验失败）')

  const minorVersion = u2()
  const majorVersion = u2()
  const cpCount = u2()

  // 常量池
  const cp: (string|null)[] = [null]
  for (let i = 1; i < cpCount; i++) {
    const tag = u1()
    switch (tag) {
      case 1:  { const l=u2(); cp.push(new TextDecoder().decode(new Uint8Array(buf,off,l))); skip(l); break }
      case 7:  cp.push('\x07:'+u2()); break
      case 8:  cp.push('\x08:'+u2()); break   // String → 指向 Utf8
      case 9:  { const c=u2(),n=u2(); cp.push(`\x09:${c}:${n}`); break }   // Fieldref
      case 10: { const c=u2(),n=u2(); cp.push(`\x0a:${c}:${n}`); break }   // Methodref
      case 11: { const c=u2(),n=u2(); cp.push(`\x0b:${c}:${n}`); break }   // InterfaceMethodref
      case 12: { const n=u2(),d=u2(); cp.push(`\x0c:${n}:${d}`); break }   // NameAndType
      case 3: case 4:  u4(); cp.push(null); break
      case 5: case 6:  u4(); u4(); cp.push(null); cp.push(null); i++; break
      case 15: u1(); u2(); cp.push(null); break
      case 16: case 19: case 20: u2(); cp.push(null); break
      case 17: case 18: u2(); u2(); cp.push(null); break
      default: throw new Error(`未知常量池 tag=${tag} index=${i} offset=${off-1}`)
    }
  }

  // 常量池辅助
  const utf8  = (i: number) => cp[i] ?? ''
  const clsName = (i: number) => { const e=cp[i]; return e?.startsWith('\x07:') ? utf8(+e.slice(2)).replace(/\//g,'.') : '' }
  const nat   = (i: number): [string,string] => {
    const e = cp[i]; if (!e?.startsWith('\x0c:')) return ['','']
    const [ni,di] = e.slice(2).split(':').map(Number); return [utf8(ni), utf8(di)]
  }
  const refComment = (cpIdx: number): string => {
    const e = cp[cpIdx]; if (!e) return ''
    const tag = e.charCodeAt(0)
    if (tag===9||tag===10||tag===11) {
      const [ci,ni] = e.slice(2).split(':').map(Number)
      const cls = clsName(ci)
      const [name,desc] = nat(ni)
      return `// ${cls}.${name}:${desc}`
    }
    if (tag===8) return `// String "${utf8(+e.slice(2))}"`
    if (tag===7) return `// class ${clsName(cpIdx)}`
    return ''
  }

  const accessFlags = u2()
  const thisClass   = clsName(u2())
  const superIdx    = u2()
  const superClass  = superIdx ? clsName(superIdx) : ''
  const ifCount     = u2()
  const interfaces: string[] = []
  for (let i = 0; i < ifCount; i++) interfaces.push(clsName(u2()))

  // 成员解析（保留 Code 属性原始字节）
  interface Member { flags:number; name:string; desc:string; code:Uint8Array|null }
  const parseMembers = (): Member[] => {
    const count = u2(); const list: Member[] = []
    for (let i = 0; i < count; i++) {
      const flags=u2(), ni=u2(), di=u2()
      let code: Uint8Array|null = null
      const ac = u2()
      for (let j = 0; j < ac; j++) {
        const an = utf8(u2()), al = u4()
        if (an === 'Code') { code = new Uint8Array(buf, off, al); skip(al) }
        else skip(al)
      }
      list.push({ flags, name:utf8(ni), desc:utf8(di), code })
    }
    return list
  }
  const fields  = parseMembers()
  const methods = parseMembers()

  // ── 字节码反汇编 ──────────────────────────────────
  function disassemble(code: Uint8Array): string[] {
    // Code 属性布局: max_stack(2) max_locals(2) code_length(4) code(...)
    const dv   = new DataView(code.buffer, code.byteOffset, code.byteLength)
    const maxStack  = dv.getUint16(0)
    const maxLocals = dv.getUint16(2)
    const codeLen   = dv.getUint32(4)
    const base = 8  // code 字节起始偏移（相对于 code 属性）

    const lines: string[] = []
    lines.push(`    Code:  // stack=${maxStack}, locals=${maxLocals}`)

    let pc = 0
    while (pc < codeLen) {
      const op = code[base + pc]
      const entry = OPCODES[op]
      if (!entry) { lines.push(`      ${String(pc).padStart(5)}: ???(0x${op.toString(16)})`); pc++; continue }

      const [mnem, operandLen] = entry

      if (operandLen === -1) {
        // 变长指令
        if (op === 0xaa) {           // tableswitch
          const start = pc + 1
          const pad = (4 - (start % 4)) % 4
          let p = base + pc + 1 + pad
          const def    = dv.getInt32(p); p+=4
          const low    = dv.getInt32(p); p+=4
          const high   = dv.getInt32(p); p+=4
          const count  = high - low + 1
          lines.push(`      ${String(pc).padStart(5)}: tableswitch { // ${low} to ${high}`)
          for (let k = 0; k < count; k++) {
            const off2 = dv.getInt32(p); p+=4
            lines.push(`                   ${low+k}: ${pc+off2}`)
          }
          lines.push(`              default: ${pc+def} }`)
          pc += 1 + pad + 12 + count*4
        } else if (op === 0xab) {    // lookupswitch
          const start = pc + 1
          const pad = (4 - (start % 4)) % 4
          let p = base + pc + 1 + pad
          const def   = dv.getInt32(p); p+=4
          const npairs= dv.getInt32(p); p+=4
          lines.push(`      ${String(pc).padStart(5)}: lookupswitch {`)
          for (let k = 0; k < npairs; k++) {
            const key = dv.getInt32(p); p+=4
            const off2= dv.getInt32(p); p+=4
            lines.push(`                   ${key}: ${pc+off2}`)
          }
          lines.push(`              default: ${pc+def} }`)
          pc += 1 + pad + 8 + npairs*8
        } else if (op === 0xc4) {   // wide
          const subop = code[base + pc + 1]
          const idx   = dv.getUint16(base + pc + 2)
          const subMnem = OPCODES[subop]?.[0] ?? `0x${subop.toString(16)}`
          if (subop === 0x84) {     // wide iinc
            const val = dv.getInt16(base + pc + 4)
            lines.push(`      ${String(pc).padStart(5)}: wide ${subMnem} ${idx} ${val}`)
            pc += 6
          } else {
            lines.push(`      ${String(pc).padStart(5)}: wide ${subMnem} ${idx}`)
            pc += 4
          }
        } else { lines.push(`      ${String(pc).padStart(5)}: ${mnem}`); pc++ }
        continue
      }

      // 固定长度指令
      let operandStr = ''
      let comment    = ''
      if (operandLen === 1) {
        const v = code[base + pc + 1]
        if (op === 0x12) { comment = refComment(v); operandStr = `#${v}` }  // ldc
        else operandStr = String(v)
      } else if (operandLen === 2) {
        const v = dv.getUint16(base + pc + 1)
        // 跳转指令用有符号偏移
        if (op>=0x99&&op<=0xa8) { operandStr = String(pc + dv.getInt16(base+pc+1)) }
        else if (op===0xc6||op===0xc7) { operandStr = String(pc + dv.getInt16(base+pc+1)) }
        else { comment = refComment(v); operandStr = `#${v}` }
      } else if (operandLen === 3) {
        const v1=dv.getUint16(base+pc+1), v2=code[base+pc+3]
        operandStr = `#${v1} ${v2}`
      } else if (operandLen === 4) {
        if (op===0xb9||op===0xba) {
          const v=dv.getUint16(base+pc+1); comment=refComment(v); operandStr=`#${v}`
        } else {
          operandStr = String(dv.getInt32(base+pc+1))
        }
      }

      const pad = operandStr ? ` ${operandStr}` : ''
      const cmt = comment    ? `   ${comment}`  : ''
      lines.push(`      ${String(pc).padStart(5)}: ${mnem}${pad}${cmt}`)
      pc += 1 + operandLen
    }
    return lines
  }

  // ── 格式化工具 ────────────────────────────────────
  const javaVer = majorVersion >= 49 ? `Java ${majorVersion-44}` : `major ${majorVersion}`

  function typeKw(f: number) {
    if (f & ACC_ANNOTATION) return '@interface'
    if (f & ACC_ENUM)       return 'enum'
    if (f & ACC_INTERFACE)  return 'interface'
    return 'class'
  }
  function vis(f: number) {
    if (f & ACC_PUBLIC)    return 'public'
    if (f & ACC_PROTECTED) return 'protected'
    if (f & ACC_PRIVATE)   return 'private'
    return ''
  }
  function mods(f: number, isClass=false): string {
    const p: string[] = []; const v=vis(f); if(v) p.push(v)
    if (!isClass && f&ACC_STATIC)       p.push('static')
    if (f&ACC_FINAL)                    p.push('final')
    if (f&ACC_ABSTRACT&&!(f&ACC_INTERFACE)) p.push('abstract')
    if (!isClass && f&ACC_SYNCHRONIZED) p.push('synchronized')
    if (!isClass && f&ACC_NATIVE)       p.push('native')
    if (!isClass && f&ACC_VOLATILE)     p.push('volatile')
    if (!isClass && f&ACC_TRANSIENT)    p.push('transient')
    if (f&ACC_SYNTHETIC)                p.push('/*synthetic*/')
    return p.join(' ')
  }
  function consumeDesc(s: string, i: number): [string,number] {
    const P: Record<string,string> = {B:'byte',C:'char',D:'double',F:'float',I:'int',J:'long',S:'short',V:'void',Z:'boolean'}
    const ch=s[i]
    if (ch in P) return [P[ch],1]
    if (ch==='L') { const e=s.indexOf(';',i); return [s.slice(i+1,e).replace(/\//g,'.'),e-i+1] }
    if (ch==='[') { const [t,l]=consumeDesc(s,i+1); return [t+'[]',l+1] }
    return [ch,1]
  }
  function fmtField(desc: string) { return consumeDesc(desc,0)[0] }
  function fmtMethod(name: string, desc: string) {
    const close=desc.lastIndexOf(')')
    const params: string[]=[]
    let i=1; while(i<close){ const [t,l]=consumeDesc(desc,i); params.push(t); i+=l }
    const ret=consumeDesc(desc,close+1)[0]
    const simpleName = thisClass.split('.').pop()
    if (name==='<init>')   return `${simpleName}(${params.join(', ')})`
    if (name==='<clinit>') return `static {}`
    return `${ret} ${name}(${params.join(', ')})`
  }

  // ── 拼装输出 ──────────────────────────────────────
  const lines: string[] = []
  lines.push(`Classfile ${props.file.name}`)
  lines.push(`  Compiled from "${thisClass.split('.').pop()}.java"  [${javaVer}, minor ${minorVersion}]`)
  lines.push(`  Constant pool: ${cpCount-1} entries`)
  lines.push('')

  let decl = mods(accessFlags, true); if(decl) decl+=' '
  decl += typeKw(accessFlags)+' '+thisClass
  if (superClass && superClass!=='java.lang.Object') decl+=` extends ${superClass}`
  if (interfaces.length) decl+=` implements ${interfaces.join(', ')}`
  lines.push(decl+' {')

  if (fields.length) {
    lines.push('')
    for (const f of fields) {
      if (f.flags & ACC_SYNTHETIC) continue
      const m=mods(f.flags)
      lines.push(`  ${m?m+' ':''}${fmtField(f.desc)} ${f.name};`)
    }
  }

  for (const m of methods) {
    lines.push('')
    const mod=mods(m.flags)
    lines.push(`  ${mod?mod+' ':''}${fmtMethod(m.name, m.desc)};`)
    if (m.code) {
      try { lines.push(...disassemble(m.code)) }
      catch(e) { lines.push(`    // 字节码解析失败: ${(e as Error).message}`) }
    }
  }

  lines.push('}')
  return lines.join('\n')
}

onMounted(async () => {
  try { output.value = parseClass(await props.file.arrayBuffer()) }
  catch(e) { error.value = '解析失败：'+(e as Error).message }
})
</script>

<style scoped>
.class-wrap { width:100%; height:100%; overflow:auto; box-sizing:border-box; }
.status-tip { display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-faint); font-size:14px; }
.status-tip.error { color:#e53e3e; }
.javap-output {
  margin:0; padding:20px 24px;
  font-family:'Courier New',Consolas,monospace;
  font-size:13px; line-height:1.7;
  color:var(--text-secondary);
  white-space:pre; tab-size:2;
}
</style>
