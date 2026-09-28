import { requireUser } from "@/lib/server/auth";
import { exportMyData } from "@/lib/server/export";
import { rateLimit, route } from "@/lib/server/http";

/** Stream the documented account export, with counts and a completion marker. */
export const GET = route(async () => {
  const user = await requireUser(true);
  await rateLimit(`export:${user.id}`, 5, 60 * 60_000);
  const data = exportMyData(user);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try { const next = await data.next(); if (next.done) controller.close(); else controller.enqueue(encoder.encode(next.value)); }
      catch (err) { controller.error(err); }
    },
    async cancel() { await data.return(undefined); },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-craftbase-data.json"`,
      "Cache-Control": "no-store",
    },
  });
});
