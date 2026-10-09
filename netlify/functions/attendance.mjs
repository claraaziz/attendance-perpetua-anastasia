import { getStore } from "@netlify/blobs";

export default async (req) => {
  const store = getStore("attendance");

  if (req.method === "GET") {
    const data = await store.get("latest", { type: "json" });
    return new Response(JSON.stringify(data || null), {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return new Response("bad request", { status: 400 }); }
    if (!process.env.ADMIN_PASSWORD || body.password !== process.env.ADMIN_PASSWORD) {
      return new Response("unauthorized", { status: 401 });
    }
    if (!Array.isArray(body.rows)) return new Response("bad request", { status: 400 });
    const rows = body.rows.map((r) => ({ n: String(r.n), no: !!r.no }));
    await store.setJSON("latest", { rows, at: Date.now() });
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  }

  return new Response("method not allowed", { status: 405 });
};

export const config = { path: "/api/attendance" };
