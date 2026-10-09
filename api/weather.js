// Muses Guide · καιρός από MET Norway (δωρεάν και για εμπορική χρήση, με αναφορά πηγής· CC BY 4.0)
// Όροι: αναγνωριστικό User-Agent με στοιχεία επικοινωνίας, έως 4 δεκαδικά στις συντεταγμένες, cache των απαντήσεων.
const TZ = 'Europe/Athens';
const localParts = iso => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(new Date(iso));
  const g = t => (p.find(x => x.type === t) || {}).value;
  return { day: g('year') + '-' + g('month') + '-' + g('day'), hour: parseInt(g('hour'), 10) % 24 };
};
// Αίσθηση θερμοκρασίας (Steadman / BoM): θερμοκρασία, υγρασία, άνεμος
const feels = (t, rh, ws) => {
  if (typeof t !== 'number') return null;
  if (typeof rh !== 'number' || typeof ws !== 'number') return Math.round(t);
  const e = rh / 100 * 6.105 * Math.exp(17.27 * t / (237.7 + t));
  return Math.round(t + 0.33 * e - 0.70 * ws - 4.00);
};

export default async function handler(req, res) {
  const lat = Math.round(parseFloat(req.query.lat) * 100) / 100, lng = Math.round(parseFloat(req.query.lng) * 100) / 100;
  if (!(lat > 34 && lat < 36.5 && lng > 23 && lng < 27)) return res.status(400).json({ ok: false });
  try {
    const r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lng}`, {
      headers: { 'User-Agent': process.env.WEATHER_USER_AGENT || 'muses-guide/1.0 https://musestravel.com' }
    });
    if (!r.ok) return res.status(502).json({ ok: false });
    const j = await r.json();
    const ts = (j.properties && j.properties.timeseries) || [];
    // Τώρα: η πιο πρόσφατη ώρα που δεν έχει περάσει πάνω από 1 ώρα
    const nowMs = Date.now();
    const cur = ts.find(t => new Date(t.time).getTime() >= nowMs - 3600e3) || ts[0];
    let now = null;
    if (cur && cur.data && cur.data.instant) {
      const d = cur.data.instant.details || {}, nx = cur.data.next_1_hours || cur.data.next_6_hours || {};
      now = { temp: typeof d.air_temperature === 'number' ? Math.round(d.air_temperature) : null,
              feels: feels(d.air_temperature, d.relative_humidity, d.wind_speed),
              wind: typeof d.wind_speed === 'number' ? Math.round(d.wind_speed * 3.6) : null,
              dir: typeof d.wind_from_direction === 'number' ? Math.round(d.wind_from_direction) : null,
              sym: (nx.summary && nx.summary.symbol_code) || '' };
      if (now.temp === null) now = null;
    }
    const days = {};
    for (const t of ts) {
      const L = localParts(t.time);
      const temp = t.data && t.data.instant && t.data.instant.details && t.data.instant.details.air_temperature;
      const d = days[L.day] || (days[L.day] = { date: L.day, tmax: -99, tmin: 99, sym: '', symHour: 99, n: 0 });
      d.n++;
      if (typeof temp === 'number') { d.tmax = Math.max(d.tmax, temp); d.tmin = Math.min(d.tmin, temp); }
      const sym = (t.data.next_6_hours || t.data.next_1_hours || {}).summary;
      const dist = Math.abs(L.hour - 13);
      if (sym && dist < d.symHour) { d.sym = sym.symbol_code; d.symHour = dist; }
    }
    // η πρώτη μέρα πάντα· οι επόμενες μόνο αν έχουν αρκετές ώρες (αλλιώς το max/min είναι μισό)
    const out = Object.values(days).filter((d, i) => d.tmax > -99 && (i === 0 || d.n >= 4)).slice(0, 6).map(d => ({ date: d.date, tmax: Math.round(d.tmax), tmin: Math.round(d.tmin), sym: d.sym }));
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=7200');
    return res.status(200).json({ ok: true, now, days: out, source: 'MET Norway' });
  } catch (e) {
    return res.status(502).json({ ok: false });
  }
}
