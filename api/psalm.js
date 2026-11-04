const blob = require("@vercel/blob");
const { put } = blob;

const tokenKey = Object.keys(process.env).find((k) => k.endsWith("READ_WRITE_TOKEN"));
const token = tokenKey ? process.env[tokenKey] : undefined;
const PATH = "psalm-state.json"; // نفس الملف القديم — البيانات القديمة بتتحول تلقائياً

const DEFAULT_ID = "t1";
const DEFAULT_NAME = 'مز "اللهم باسمك خلصني"';

const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "");
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// الشكل القديم:  { done: { اسم: تاريخ }, at }
// الشكل الجديد: { tabs: [{id,name,archived}], data: { tabId: { اسم: تاريخ } }, at }
// لو الملف لسه بالشكل القديم، كل العلامات القديمة بتتحط في تبويب مز "اللهم باسمك خلصني"
function normalize(s) {
  s = s || {};
  if (Array.isArray(s.tabs)) {
    return { tabs: s.tabs, data: s.data || {}, at: s.at || null };
  }
  return {
    tabs: [{ id: DEFAULT_ID, name: DEFAULT_NAME, archived: false }],
    data: { [DEFAULT_ID]: s.done || {} },
    at: s.at || null,
  };
}

async function readState() {
  try {
    const g = await blob.get(PATH, { access: "private", token, useCache: false });
    if (!g || !g.stream) return normalize({});
    return normalize(JSON.parse(await new Response(g.stream).text()));
  } catch (e) {
    if (e && (e.name === "BlobNotFoundError" || /not.?found/i.test(String(e.message)))) return normalize({});
    throw e;
  }
}

const newId = () => "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const ADMIN_OPS = ["tab-add", "tab-del", "tab-archive"];

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      if (!token) return res.status(200).json({ ...normalize({}), off: true });
      return res.status(200).json(await readState());
    }

    if (req.method === "POST") {
      if (!token) return res.status(500).send("مفيش token للـ Blob");
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const st = await readState();
      const { tabs, data } = st;
      const op = body.op;

      if (ADMIN_OPS.includes(op)) {
        // عمليات الأدمن: إضافة / حذف / أرشفة تبويب
        if (!process.env.ADMIN_PASSWORD || body.password !== process.env.ADMIN_PASSWORD) {
          return res.status(401).send("unauthorized");
        }
        if (op === "tab-add") {
          const name = String(body.name || "").trim().slice(0, 60);
          if (!name) return res.status(400).send("اكتب اسم التبويب");
          const id = newId();
          tabs.push({ id, name, archived: false });
          data[id] = {};
        } else if (op === "tab-del") {
          const i = tabs.findIndex((t) => t.id === body.id);
          if (i < 0) return res.status(404).send("التبويب مش موجود");
          tabs.splice(i, 1);
          delete data[body.id];
        } else if (op === "tab-archive") {
          const t = tabs.find((x) => x.id === body.id);
          if (!t) return res.status(404).send("التبويب مش موجود");
          t.archived = !!body.archived;
        }
      } else {
        // عمليات التعليم العادية (جوه تبويب معين)
        const tid = String(body.t || "");
        const tab = tabs.find((t) => t.id === tid);
        if (!tab) return res.status(404).send("التبويب مش موجود");
        if (tab.archived) return res.status(400).send("التبويب ده في الأرشيف");
        const done = (data[tid] = data[tid] || {});
        if (op === "set" && body.k && isDate(body.d)) done[String(body.k)] = body.d;
        else if (op === "del" && body.k) delete done[String(body.k)];
        else if (op === "clear") Object.keys(done).forEach((k) => delete done[k]);
        else if (op === "merge" && body.done && typeof body.done === "object") {
          for (const [k, d] of Object.entries(body.done)) if (isDate(d) && !has(done, k)) done[k] = d;
        } else return res.status(400).send("bad request");
      }

      const out = { tabs, data, at: Date.now() };
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