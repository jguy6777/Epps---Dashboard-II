module.exports = async (req, res) => {
  const user = (process.env.ARCGIS_USERNAME || '').trim();
  const pass = (process.env.ARCGIS_PASSWORD || '').trim();


  try {
    const body = new URLSearchParams({
      username: user,
      password: pass,
      client: 'referer',
      referer: 'https://epps-dashboard-ii.vercel.app',
      expiration: '60',
      f: 'json',
    });
    const r = await fetch('https://maps.segland.com/arcgis/tokens/generateToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await r.json();
    if (data.error || !data.token) {
      return res.status(502).json({ error: data.error || 'No token returned' });
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ token: data.token, expires: data.expires });
  } catch (e) {
    res.status(500).json({ error: 'Could not reach ArcGIS Server', detail: String(e) });
  }
};