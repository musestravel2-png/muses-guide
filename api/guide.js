// Muses Guide · δεδομένα οδηγού από το Apps Script (με μυστικό κλειδί που δεν φτάνει ποτέ στον browser)
export default async function handler(req, res) {
  const q = req.query || {};
  const v = String(q.v || '').toLowerCase();
  if (!/^[a-z0-9α-ω-]{1,80}$/.test(v)) return res.status(400).json({ ok: false, code: 'BAD_REQUEST' });
  if (!process.env.GAS_URL || !process.env.GUIDE_SECRET) return res.status(500).json({ ok: false, code: 'NOT_CONFIGURED' });
  const clean = (s, max) => String(s || '').replace(/[^A-Za-z0-9]/g, '').slice(0, max);
  const params = new URLSearchParams({
    guide: '1', v, k: clean(q.k, 12), h: clean(q.h, 12), p: clean(q.p, 16),
    lang: clean(q.lang, 2).toLowerCase(), secret: process.env.GUIDE_SECRET
  });
  const personal = params.get('k') || params.get('h') || params.get('p');
  try {
    const r = await fetch(process.env.GAS_URL + (process.env.GAS_URL.includes('?') ? '&' : '?') + params.toString(), { redirect: 'follow' });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { return res.status(502).json({ ok: false, code: 'UPSTREAM' }); }
    res.setHeader('Cache-Control', personal ? 'private, no-store' : 's-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ ok: false, code: 'UPSTREAM' });
  }
}
