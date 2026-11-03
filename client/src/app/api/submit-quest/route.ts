import { resilientFetch } from "@/lib/resilientFetch";
import { forwardDevAccess } from "@/lib/devAccess";
export async function POST(req: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  const body = await req.json();

  const res = await resilientFetch(`${baseUrl}/api/quest/submit-quest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...forwardDevAccess(req),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return Response.json(data, { status: res.status });
}