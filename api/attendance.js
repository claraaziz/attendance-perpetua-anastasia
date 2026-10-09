const { put, list } = require("@vercel/blob");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const { blobs } = await list({ prefix: "attendance-latest" });
      if (!blobs.length) return res.status(200).json(null);
      const r = await fetch(blobs[0].url + "?t=" + Date.now());
      return res.status(200).json(await r.json());
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      if (!process.env.ADMIN_PASSWORD || body.password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).send("unauthorized");
      }
      if (!Array.isArray(body.rows)) return res.status(400).send("bad request");
      const rows = body.rows.map((r) => ({ n: String(r.n), no: !!r.no }));
      await put("attendance-latest.json", JSON.stringify({ rows, at: Date.now() }), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).send("method not allowed");
  } catch (e) {
    return res.status(500).send(String(e.message || e));
  }
};
