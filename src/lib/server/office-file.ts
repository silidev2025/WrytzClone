import { inflateRawSync } from "node:zlib";

/** Inspect the ZIP directory and bounded XML members; this is format validation, not antivirus. */
export function isOfficePackage(bytes: Buffer, extension: string): boolean {
  const main: Record<string, string> = { docx: "word/document.xml", xlsx: "xl/workbook.xml", pptx: "ppt/presentation.xml" };
  if (!main[extension] || bytes.length < 22) return false;
  try {
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
      if (bytes.readUInt32LE(i) === 0x06054b50 && i + 22 + bytes.readUInt16LE(i + 20) === bytes.length) { end = i; break; }
    if (end < 0 || bytes.readUInt32LE(end + 4) !== 0) return false;
    const count = bytes.readUInt16LE(end + 10), length = bytes.readUInt32LE(end + 12), offset = bytes.readUInt32LE(end + 16);
    if (!count || count > 4096 || bytes.readUInt16LE(end + 8) !== count || offset + length !== end) return false;
    const names = new Set<string>(); const xml = new Map<string, string>();
    let at = offset, expanded = 0;
    for (let n = 0; n < count; n++) {
      if (at + 46 > end || bytes.readUInt32LE(at) !== 0x02014b50) return false;
      const flags = bytes.readUInt16LE(at + 8), method = bytes.readUInt16LE(at + 10);
      const compressed = bytes.readUInt32LE(at + 20), size = bytes.readUInt32LE(at + 24);
      const nameLength = bytes.readUInt16LE(at + 28), extra = bytes.readUInt16LE(at + 30), comment = bytes.readUInt16LE(at + 32);
      const local = bytes.readUInt32LE(at + 42);
      const name = bytes.toString("utf8", at + 46, at + 46 + nameLength);
      if ((flags & 1) || ![0, 8].includes(method) || names.has(name) || /(^\/|\\|(^|\/)\.\.\/|vbaProject\.bin$)/i.test(name)) return false;
      names.add(name); expanded += size;
      if (expanded > 100 * 1024 * 1024 || size > 200 * Math.max(compressed, 1) || local + 30 > offset || bytes.readUInt32LE(local) !== 0x04034b50) return false;
      const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
      if (start + compressed > offset || bytes.readUInt16LE(local + 8) !== method || bytes.toString("utf8", local + 30, local + 30 + bytes.readUInt16LE(local + 26)) !== name) return false;
      if (name === "[Content_Types].xml" || name === main[extension]) {
        if (size > 8 * 1024 * 1024) return false;
        const payload = bytes.subarray(start, start + compressed);
        const decoded = method === 8 ? inflateRawSync(payload, { maxOutputLength: 8 * 1024 * 1024 }) : payload;
        if (decoded.length !== size) return false;
        const text = decoded.toString("utf8");
        if (/<!DOCTYPE|<!ENTITY/i.test(text)) return false;
        xml.set(name, text);
      }
      at += 46 + nameLength + extra + comment;
    }
    const root = { docx: "document", xlsx: "workbook", pptx: "presentation" }[extension];
    return at === end && !!xml.get("[Content_Types].xml")?.includes(main[extension]) && new RegExp(`<([A-Za-z0-9_]+:)?${root}[\\s>]`).test(xml.get(main[extension]) || "");
  } catch { return false; }
}
