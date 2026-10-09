const blob = require("@vercel/blob");
const { put, list } = blob;

const tokenKey = Object.keys(process.env).find((k) => k.endsWith("READ_WRITE_TOKEN"));
const token = tokenKey ? process.env[tokenKey] : undefined;
const NAME = "attendance-latest.json";

async function readJson(b) {
  const g = await blob.get(b.pathname, { access: "private", token });
  return JSON.parse(await new Response(g.stream).text());
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      if (!token) return res.status(200).json(null);
      const { blobs } = await list({ prefix: "attendance-latest", token });
      if (!blobs.length) return res.status(200).json(null);
      return res.status(200).json(await readJson(blobs[0]));
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      if (!process.env.ADMIN_PASSWORD || body.password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).send("unauthorized");
      }
      if (!token) return res.status(500).send("v4: مفيش token للـ Blob");
      if (!Array.isArray(body.rows)) return res.status(400).send("bad request");
      const rows = body.rows.map((r) => ({ n: String(r.n), no: !!r.no }));
      await put(NAME, JSON.stringify({ rows, at: Date.now() }), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        token,
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).send("method not allowed");
  } catch (e) {
    return res.status(500).send("v4: " + String(e.message || e));
  }
  //test
};
