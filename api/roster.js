// بيجيب الشيت كـ CSV خام من جوجل (من السيرفر) عشان الأرقام اللي فيها "/" ما تضيعش
const SPREADSHEET_ID = "1ziPq8DvCJkDaVfAFP9chlyUlyuhl_i-way2lyb2eev8";

module.exports = async (req, res) => {
  // ?all=1 : الملف كله (كل الشيتات) كـ xlsx، فالأرقام اللي فيها "/" أو كلام بتوصل زي ما هي
  if (req.query && req.query.all) {
    try {
      const r = await fetch(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=xlsx`);
      const type = r.headers.get("content-type") || "";
      if (!r.ok || !type.includes("spreadsheet")) return res.status(502).send("sheet not accessible");
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
      return res.status(200).send(Buffer.from(await r.arrayBuffer()));
    } catch (e) {
      return res.status(500).send(String(e.message || e));
    }
  }
  const gid = String((req.query && req.query.gid) || "").replace(/\D/g, "");
  if (!gid) return res.status(400).send("gid مطلوب");
  try {
    const r = await fetch(
      `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`
    );
    if (!r.ok) return res.status(502).send("google " + r.status);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).send(await r.text());
  } catch (e) {
    return res.status(500).send(String(e.message || e));
  }
};