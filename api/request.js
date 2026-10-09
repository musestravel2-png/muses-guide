// Muses Guide · αίτημα εμπειρίας → Apps Script (ConciergeEngine: αίτημα, πρόταση, ειδοποίηση)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, code: 'METHOD' });
  if (!process.env.GAS_URL || !process.env.GUIDE_SECRET) return res.status(500).json({ ok: false, code: 'NOT_CONFIGURED' });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== 'object') return res.status(400).json({ ok: false, code: 'BAD_REQUEST' });
  const s = (x, max) => String(x == null ? '' : x).trim().slice(0, max);
  const payload = {
    guide_action: 'request', secret: process.env.GUIDE_SECRET,
    v: s(b.v, 80).toLowerCase(), k: s(b.k, 12).replace(/[^A-Za-z0-9]/g, ''),
    service: s(b.service, 80), date: /^\d{4}-\d{2}-\d{2}$/.test(s(b.date, 10)) ? s(b.date, 10) : '',
    persons: Math.max(1, Math.min(30, parseInt(b.persons, 10) || 1)),
    email: s(b.email, 120), name: s(b.name, 80), phone: s(b.phone, 40), note: s(b.note, 500), lang: s(b.lang, 2).toLowerCase()
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(payload.email)) return res.status(200).json({ ok: false, code: 'EMAIL' });
  try {
    const r = await fetch(process.env.GAS_URL.trim(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), redirect: 'follow' });
    const text = await r.text();
    try { return res.status(200).json(JSON.parse(text)); } catch (e) {
      console.error('[request] Apps Script δεν έδωσε JSON', JSON.stringify({ status: r.status, title: (text.match(/<title>([^<]*)<\/title>/i) || [])[1] || text.slice(0, 160) }));
      return res.status(502).json({ ok: false, code: 'UPSTREAM' });
    }
  } catch (e) {
    return res.status(502).json({ ok: false, code: 'UPSTREAM' });
  }
}
