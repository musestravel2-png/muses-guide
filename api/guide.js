// Muses Guide · δεδομένα οδηγού από το Apps Script (με μυστικό κλειδί που δεν φτάνει ποτέ στον browser)
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callGas(url, timeoutMs) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ac.signal });
    const text = await r.text();
    try { return { data: JSON.parse(text) }; } catch (e) {
      // Το Apps Script απάντησε με σελίδα αντί για JSON: γράφουμε στο log τι ήταν, για γρήγορη διάγνωση
      const title = (text.match(/<title>([^<]*)<\/title>/i) || [])[1] || text.replace(/\s+/g, ' ').slice(0, 160);
      const kind = /accounts\.google\.com|ServiceLogin|Sign in/i.test(text) ? 'GOOGLE_LOGIN (πρόσβαση web app ή URL /dev)'
        : /Muses PMS|Command Center/i.test(text) ? 'OLD_VERSION (η έκδοση του web app δεν έχει τον οδηγό)'
        : /Script function not found|Δεν βρέθηκε η συνάρτηση/i.test(text) ? 'NO_DOGET'
        : r.status === 404 ? 'NOT_FOUND (λάθος GAS_URL: πάρε το URL από Manage deployments)' : 'NOT_JSON';
      return { fail: kind, log: { status: r.status, finalUrl: (r.url || '').replace(/secret=[^&]+/, 'secret=***').slice(0, 200), kind, title } };
    }
  } catch (e) {
    return { fail: e && e.name === 'AbortError' ? 'TIMEOUT' : 'FETCH_FAILED', log: { error: e && e.message } };
  } finally { clearTimeout(t); }
}

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
  const gasUrl = process.env.GAS_URL.trim();
  const url = gasUrl + (gasUrl.includes('?') ? '&' : '?') + params.toString();
  const t0 = Date.now();

  // Μία αυτόματη επανάληψη αν το Apps Script κόλλησε ή έδωσε προσωρινό σφάλμα
  let out = await callGas(url, 20000);
  const retryable = out.fail ? !/^(GOOGLE_LOGIN|OLD_VERSION|NO_DOGET|NOT_FOUND)/.test(out.fail) : (out.data && out.data.code === 'ERROR');
  if (retryable && Date.now() - t0 < 14000) {
    console.warn('[guide] επανάληψη', JSON.stringify({ v, first: out.fail || out.data.code, ms: Date.now() - t0 }));
    await sleep(400);
    out = await callGas(url, Math.max(5000, 28000 - (Date.now() - t0)));
  }
  const ms = Date.now() - t0;

  if (out.fail) {
    console.error('[guide] Apps Script δεν έδωσε JSON', JSON.stringify(Object.assign({ ms }, out.log)));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ ok: false, code: 'UPSTREAM', detail: out.fail.split(' ')[0] });
  }
  const data = out.data;
  if (!data || !data.ok) {
    console.warn('[guide] απάντηση χωρίς οδηγό', JSON.stringify({ v, code: data && data.code, ms }));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data || { ok: false, code: 'ERROR' });
  }
  if (ms > 6000) console.warn('[guide] αργή απάντηση', JSON.stringify({ v, mode: data.mode, lang: data.lang, ms }));
  res.setHeader('Cache-Control', personal ? 'private, no-store' : 's-maxage=300, stale-while-revalidate=3600');
  return res.status(200).json(data);
}
