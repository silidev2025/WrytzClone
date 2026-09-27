import { currentUser, publicUser } from "@/lib/server/auth";
import { route } from "@/lib/server/http";

export const GET = route(async () => {
  const user = await currentUser();
  return { user: user ? publicUser(user) : null };
});
