import { requireUser } from "@/lib/server/auth";
import { exportMyData } from "@/lib/server/account";
import { rateLimit, route } from "@/lib/server/http";

/** Download everything we hold about you (JSON). */
export const GET = route(async () => {
  const user = await requireUser();
  rateLimit(`export:${user.id}`, 5, 60 * 60_000);
  const data = await exportMyData(user);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-craftbase-data.json"`,
      "Cache-Control": "no-store",
    },
  });
});
