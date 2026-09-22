module.exports = async (req, res) => {
  const user = (process.env.ARCGIS_USERNAME || '').trim();
  const pass = (process.env.ARCGIS_PASSWORD || '').trim();

  // TEMPORARY: visit /api/arcgis-token?debug=1 to check the variables
  if (req.query.debug) {
    return res.status(200).json({
      usernameSet: !!user,
      usernameLength: user.length,
      usernameStart: user.slice(0, 3),
      passwordSet: !!pass,
      passwordLength: pass.length,
      rawPasswordLength: (process.env.ARCGIS_PASSWORD || '').length,
      environment: process.env.VERCEL_ENV,
    });
  }

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