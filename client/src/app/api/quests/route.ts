import { resilientFetch } from "@/lib/resilientFetch";
import { forwardDevAccess } from "@/lib/devAccess";
export async function GET(req: Request) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

    console.log("PROXY CALL →", baseUrl);

    const res = await resilientFetch(`${baseUrl}/api/quests`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...forwardDevAccess(req),
      },
    });

    const data = await res.json();

    return Response.json(data);
  } catch (err) {
    console.error("PROXY ERROR:", err);
    return Response.json(
      { error: "Failed to fetch quests" },
      { status: 500 }
    );
  }
}