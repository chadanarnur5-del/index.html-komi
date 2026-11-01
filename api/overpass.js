// Vercel Serverless Function: прокси к Overpass API (OpenStreetMap) для мест рядом с кампусом.
// Запросы идут с сервера, поэтому их не блокируют браузер и расширения; ответы кешируются на сутки.
// Файл должен лежать по пути  api/overpass.js  рядом с api/translate.js.
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  let r = parseInt(req.query.r || '2000', 10);
  const m = Math.min(Math.max(parseInt(req.query.m || '0', 10) || 0, 0), MIRRORS.length - 1);

  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'Bad coordinates' });
  }
  r = Math.min(Math.max(isFinite(r) ? r : 2000, 200), 5000);

  const a = `(around:${r},${lat},${lng})`;
  const query = '[out:json][timeout:25];('
    + `nwr${a}["diet:halal"~"^(yes|only)$"];`
    + `nwr${a}["diet:vegan"~"^(yes|only)$"];`
    + `nwr${a}["shop"="convenience"]["opening_hours"="24/7"];`
    + `nwr${a}["amenity"="pharmacy"];`
    + `nwr${a}["amenity"="hospital"];`
    + ');out center tags 300;';

  // Один запрос = одно зеркало (лимит времени функции на бесплатном тарифе ~10 с);
  // страница сама переберёт зеркала, передавая m=0,1,2
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const response = await fetch(MIRRORS[m], {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'WorldCampusBridge/1.0' },
      body: 'data=' + encodeURIComponent(query),
      signal: ctrl.signal
    });
    if (!response.ok) return res.status(502).json({ error: `Overpass HTTP ${response.status}` });
    const data = await response.json();
    if (!Array.isArray(data.elements) || (data.remark && !data.elements.length)) {
      return res.status(502).json({ error: data.remark || 'Empty Overpass response' });
    }
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: e.name === 'AbortError' ? 'Overpass timeout' : String(e.message || e) });
  } finally {
    clearTimeout(timer);
  }
};
