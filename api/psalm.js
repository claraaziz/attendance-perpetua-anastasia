const blob = require("@vercel/blob");
const { put } = blob;

const tokenKey = Object.keys(process.env).find((k) => k.endsWith("READ_WRITE_TOKEN"));
const token = tokenKey ? process.env[tokenKey] : undefined;
const PATH = "psalm-state.json";
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "");

async function readState() {
  try {
    const g = await blob.get(PATH, { access: "private", token, useCache: false });
    if (!g || !g.stream) return { done: {}, at: null };
    const s = JSON.parse(await new Response(g.stream).text());
    return { done: s.done || {}, at: s.at || null };
  } catch (e) {
    if (e && (e.name === "BlobNotFoundError" || /not.?found/i.test(String(e.message)))) return { done: {}, at: null };
    throw e;
  }
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      if (!token) return res.status(200).json({ done: {}, at: null, off: true });
      return res.status(200).json(await readState());
    }

    if (req.method === "POST") {
      if (!token) return res.status(500).send("مفيش token للـ Blob");
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const { done } = await readState();
      if (body.op === "set" && body.k && isDate(body.d)) done[String(body.k)] = body.d;
      else if (body.op === "del" && body.k) delete done[String(body.k)];
      else if (body.op === "clear") Object.keys(done).forEach((k) => delete done[k]);
      else if (body.op === "merge" && body.done && typeof body.done === "object") {
        for (const [k, d] of Object.entries(body.done)) if (isDate(d) && !(k in done)) done[k] = d;
      } else return res.status(400).send("bad request");
      const out = { done, at: Date.now() };
      await put(PATH, JSON.stringify(out), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        token,
      });
      return res.status(200).json(out);
    }

    return res.status(405).send("method not allowed");
  } catch (e) {
    return res.status(500).send(String(e.message || e));
  }
};