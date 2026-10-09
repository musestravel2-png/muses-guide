// Muses Guide · καιρός από MET Norway (δωρεάν και για εμπορική χρήση, με αναφορά πηγής· CC BY 4.0)
// Όροι: αναγνωριστικό User-Agent με στοιχεία επικοινωνίας, cache των απαντήσεων.
export default async function handler(req, res) {
  const lat = Math.round(parseFloat(req.query.lat) * 100) / 100, lng = Math.round(parseFloat(req.query.lng) * 100) / 100;
  if (!(lat > 34 && lat < 36.5 && lng > 23 && lng < 27)) return res.status(400).json({ ok: false });
  try {
    const r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lng}`, {
      headers: { 'User-Agent': process.env.WEATHER_USER_AGENT || 'muses-guide/1.0 https://musestravel.com' }
    });
    if (!r.ok) return res.status(502).json({ ok: false });
    const j = await r.json();
    const days = {};
    for (const t of (j.properties && j.properties.timeseries) || []) {
      const local = new Date(new Date(t.time).toLocaleString('en-US', { timeZone: 'Europe/Athens' }));
      const key = local.getFullYear() + '-' + String(local.getMonth() + 1).padStart(2, '0') + '-' + String(local.getDate()).padStart(2, '0');
      const temp = t.data && t.data.instant && t.data.instant.details && t.data.instant.details.air_temperature;
      const d = days[key] || (days[key] = { date: key, tmax: -99, tmin: 99, sym: '', symHour: 99 });
      if (typeof temp === 'number') { d.tmax = Math.max(d.tmax, temp); d.tmin = Math.min(d.tmin, temp); }
      const sym = (t.data.next_6_hours || t.data.next_1_hours || {}).summary;
      const dist = Math.abs(local.getHours() - 13);
      if (sym && dist < d.symHour) { d.sym = sym.symbol_code; d.symHour = dist; }
    }
    const out = Object.values(days).filter(d => d.tmax > -99).slice(0, 4).map(d => ({ date: d.date, tmax: Math.round(d.tmax), tmin: Math.round(d.tmin), sym: d.sym }));
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=10800');
    return res.status(200).json({ ok: true, days: out, source: 'MET Norway' });
  } catch (e) {
    return res.status(502).json({ ok: false });
  }
}
