import { getStore } from "./store";

/** Authorized callers supply metadata; bytes stream in bounded reads, including HTTP ranges. */
export async function blobResponse(req: Request, id: string, size: number, headers: Record<string, string>) {
  let start = 0, end = size - 1;
  const range = req.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    if (!match[1]) start = Math.max(0, size - Number(match[2]));
    else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size)
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  const store = await getStore();
  let next = start;
  const first = await store.getBlob(id, { start, end: Math.min(end, start + 256 * 1024 - 1) });
  if (!first?.length) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  let initial: Buffer | null = first;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (next > end) { controller.close(); return; }
        const bytes = initial || await store.getBlob(id, { start: next, end: Math.min(end, next + 256 * 1024 - 1) }); initial = null;
        if (!bytes?.length) throw new Error("File disappeared during download.");
        next += bytes.length; controller.enqueue(new Uint8Array(bytes));
      } catch (err) { controller.error(err); }
    },
  });
  return new Response(stream, { status: range ? 206 : 200, headers: { ...headers, "Accept-Ranges": "bytes", "Content-Length": String(end - start + 1), ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}) } });
}
