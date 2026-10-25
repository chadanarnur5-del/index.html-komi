// Vercel Serverless Function: прокси к Google Translate.
// Запросы идут с сервера, поэтому их не блокируют браузер, расширения и CORS.
// Файл должен лежать по пути  api/translate.js  в корне проекта (рядом с index.html).
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
 
  const { q, sl = 'auto', tl, rm } = req.query || {};
  if (!q || !tl) {
    return res.status(400).json({ error: 'Parameters q and tl are required' });
  }
  if (String(q).length > 1500) {
    return res.status(413).json({ error: 'Text too long' });
  }
 
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx' +
    `&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t` +
    (rm ? '&dt=rm' : '') +
    `&q=${encodeURIComponent(q)}`;
 
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) {
      return res.status(502).json({ error: `Google HTTP ${response.status}` });
    }
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: String(e && e.message ?
