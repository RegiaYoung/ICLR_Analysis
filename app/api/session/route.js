import { auth } from "../../../lib/auth";

export async function GET(req) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response(JSON.stringify({ user: null }), { status: 200 });
  }
  return Response.json({ user: session.user });
}
