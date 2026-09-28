import { activeUser, requireUser } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { getStore } from "@/lib/server/store";
import { badRequest, clientIp, readJson, route } from "@/lib/server/http";
import { LEGAL } from "@/lib/shared/legal";

export const POST = route(async (req) => {
  const user = await requireUser(true);
  const body = await readJson(req, 2048);
  if (body.acceptTerms !== true || body.version !== LEGAL.termsVersion) throw badRequest("Review and accept the current Terms and Privacy notice.");
  await (await getStore()).transaction(async (tx) => {
    const fresh = await activeUser(tx, user.id);
    const previous = fresh.termsVersion;
    fresh.termsVersion = LEGAL.termsVersion;
    fresh.termsAcceptedAt = new Date().toISOString();
    await tx.put("users", fresh);
    await audit({ action: "terms.accepted", userId: user.id, detail: `${previous || "none"} -> ${LEGAL.termsVersion}`, ip: clientIp(req) }, tx);
  });
  return { ok: true };
});
