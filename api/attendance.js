const blob = require("@vercel/blob");
const { put, list } = blob;

const tokenKey = Object.keys(process.env).find((k) => k.endsWith("READ_WRITE_TOKEN"));
const token = tokenKey ? process.env[tokenKey] : undefined;
const NAME = "attendance-latest.json";

async function readJson(b) {
  let r = await fetch(b.url + "?t=" + Date.now());
  if (r.ok) return r.json();
  if (typeof blob.get === "function") {
    const g = await blob.get(b.pathname, { access: "private", token });
    return JSON.parse(await new Response(g.stream).text());
  }
  r = await fetch(b.downloadUrl || b.url, { headers: { authorization: "Bearer " + token } });
  if (!r.ok) throw new Error("read failed " + r.status);
  return r.json();
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
      if (!token) return res.status(500).send("مفيش token للـ Blob");
      if (!Array.isArray(body.rows)) return res.status(400).send("bad request");
      const rows = body.rows.map((r) => ({ n: String(r.n), no: !!r.no }));
      const data = JSON.stringify({ rows, at: Date.now() });
      const opts = { addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", token };
      try {
        await put(NAME, data, { ...opts, access: "public", cacheControlMaxAge: 60 });
      } catch (e) {
        if (/private/i.test(String(e.message))) await put(NAME, data, { ...opts, access: "private" });
        else throw e;
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).send("method not allowed");
  } catch (e) {
    return res.status(500).send(String(e.message || e));
  }
};