import type { Model, RomInfo, System } from './types'

const GB_LOGO = [
  0xce, 0xed, 0x66, 0x66, 0xcc, 0x0d, 0x00, 0x0b, 0x03, 0x73, 0x00, 0x83, 0x00, 0x0c, 0x00, 0x0d,
  0x00, 0x08, 0x11, 0x1f, 0x88, 0x89, 0x00, 0x0e, 0xdc, 0xcc, 0x6e, 0xe6, 0xdd, 0xdd, 0xd9, 0x99,
  0xbb, 0xbb, 0x67, 0x63, 0x6e, 0x0e, 0xec, 0xcc, 0xdd, 0xdc, 0x99, 0x9f, 0xbb, 0xb9, 0x33, 0x3e,
]

/** GBA 卡带头固定校验字节：0xB2 处必须是 0x96。 */
const GBA_FIXED_BYTE = 0x96
const MAX_ROM_SIZE = 32 * 1024 * 1024

export class RomError extends Error {}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = ''
  for (let i = start; i < start + length; i += 1) {
    const byte = bytes[i]
    if (byte === undefined || byte === 0) break
    if (byte >= 0x20 && byte < 0x7f) out += String.fromCharCode(byte)
  }
  return out.trim()
}

function hasGbLogo(bytes: Uint8Array): boolean {
  return GB_LOGO.every((value, index) => bytes[0x104 + index] === value)
}

async function sha1(bytes: Uint8Array): Promise<string> {
  const source = new Uint8Array(bytes).buffer
  const digest = await crypto.subtle.digest('SHA-1', source)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 从卡带头判定机型与核心。前端不做完整性校验，交给内核。 */
export function detectModel(bytes: Uint8Array): { system: System; model: Model; title: string } {
  if (bytes.length < 0x150) throw new RomError('文件太小，不是有效的 ROM')

  if (bytes[0xb2] === GBA_FIXED_BYTE) {
    return { system: 'gba', model: 'agb', title: ascii(bytes, 0xa0, 12) }
  }

  if (!hasGbLogo(bytes)) {
    // 没有合法头：交给内核按内容嗅探，但外壳只能退化成 DMG。
    return { system: 'gb', model: 'dmg', title: '' }
  }

  const cgbFlag = bytes[0x143] ?? 0
  const sgbFlag = bytes[0x146] ?? 0
  const title = ascii(bytes, 0x134, 16)

  if ((cgbFlag & 0x80) !== 0) return { system: 'gb', model: 'cgb', title }
  if (sgbFlag === 0x03) return { system: 'gb', model: 'sgb', title }
  return { system: 'gb', model: 'dmg', title }
}

const ROM_EXT = /\.(gba|gb|gbc|sgb)$/i

/** 只取 zip 里第一个 ROM；多 ROM 的包在 M1 交给用户挑选。 */
export async function unzipSingleRom(bytes: Uint8Array): Promise<{ bytes: Uint8Array; name: string }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  let eocd = -1
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 66_000; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new RomError('zip 结构损坏（找不到中央目录）')

  const count = view.getUint16(eocd + 10, true)
  let cursor = view.getUint32(eocd + 16, true)

  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break
    const method = view.getUint16(cursor + 10, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength))

    if (ROM_EXT.test(name)) {
      const localNameLength = view.getUint16(localOffset + 26, true)
      const localExtraLength = view.getUint16(localOffset + 28, true)
      const dataStart = localOffset + 30 + localNameLength + localExtraLength
      const data = bytes.subarray(dataStart, dataStart + compressedSize)

      if (method === 0) return { bytes: data.slice(), name }
      if (method === 8) {
        const stream = new Blob([data.slice()]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
        return { bytes: new Uint8Array(await new Response(stream).arrayBuffer()), name }
      }
      throw new RomError(`不支持 zip 压缩方式 ${method}`)
    }

    cursor += 46 + nameLength + extraLength + commentLength
  }

  throw new RomError('zip 里没有 .gba / .gb / .gbc 文件')
}

/** 脱掉 zip 外壳并嗅探头部，得到可交给内核的字节与机型信息。 */
export async function readRom(file: File): Promise<{ bytes: Uint8Array; info: RomInfo }> {
  let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer())
  let name = file.name

  if (name.toLowerCase().endsWith('.zip')) {
    const unzipped = await unzipSingleRom(bytes)
    bytes = unzipped.bytes
    name = unzipped.name
  }

  if (bytes.length > MAX_ROM_SIZE) throw new RomError('ROM 超过 32 MB，可能是误传的镜像文件')
  if (bytes.length < 0x150) throw new RomError('文件太小，不是有效的 ROM')

  const detected = detectModel(bytes)
  return {
    bytes,
    info: {
      id: await sha1(bytes),
      name,
      size: bytes.length,
      ...detected,
    },
  }
}
