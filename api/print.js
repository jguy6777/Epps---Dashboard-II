// Map PDF export through the ArcGIS Server print service.
//
//   POST /api/print   body: { webMap: <Web_Map_as_JSON object>, layout: "Tabloid ANSI B Landscape", fileName: "..." }
//   -> the finished PDF (application/pdf)
//
// The dashboard builds the web map (extent, parcel styling, selected-tract outline, title/legend)
// and this function adds the ArcGIS token server-side, so the service account credentials
// (ARCGIS_USERNAME / ARCGIS_PASSWORD — the same Vercel env vars api/arcgis-token.js uses)
// never reach the browser. The token is attached to every layer that lives on maps.segland.com
// so the print server can draw the secured EPPS layers.

const ARCGIS_HOST = 'https://maps.segland.com';
const PRINT_URL = ARCGIS_HOST + '/arcgis/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task/execute';
const REFERER = 'https://epps-dashboard-ii.vercel.app';
const LAYOUTS = new Set([
  'Tabloid ANSI B Landscape', 'Tabloid ANSI B Portrait',
  'Letter ANSI A Landscape', 'Letter ANSI A Portrait',
  'A3 Landscape', 'A3 Portrait', 'A4 Landscape', 'A4 Portrait', 'MAP_ONLY',
]);

async function getToken() {
  const body = new URLSearchParams({
    username: (process.env.ARCGIS_USERNAME || '').trim(),
    password: (process.env.ARCGIS_PASSWORD || '').trim(),
    client: 'referer',
    referer: REFERER,
    expiration: '15',
    f: 'json',
  });
  const r = await fetch(ARCGIS_HOST + '/arcgis/tokens/generateToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await r.json();
  if (data.error || !data.token) throw new Error('Token request failed: ' + JSON.stringify(data.error || data));
  return data.token;
}

function sendError(res, status, error, detail) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(detail ? { error, detail } : { error });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendError(res, 405, 'Use POST');

  let payload = req.body;
  if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch (_) { payload = null; } }
  const webMap = payload && payload.webMap;
  if (!webMap || !Array.isArray(webMap.operationalLayers)) return sendError(res, 400, 'Missing webMap');

  const layout = LAYOUTS.has(payload.layout) ? payload.layout : 'Tabloid ANSI B Landscape';
  const fileName = String(payload.fileName || 'EPPS-map').replace(/[^\w.\- ]+/g, '').slice(0, 80) || 'EPPS-map';

  try {
    const token = await getToken();

    // Only layers on our own ArcGIS Server get the token
    webMap.operationalLayers.forEach((lyr) => {
      if (lyr && typeof lyr.url === 'string' && lyr.url.startsWith(ARCGIS_HOST)) lyr.token = token;
    });

    const form = new URLSearchParams({
      Web_Map_as_JSON: JSON.stringify(webMap),
      Format: 'PDF',
      Layout_Template: layout,
      f: 'json',
    });
    const pr = await fetch(PRINT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: REFERER },
      body: form,
    });
    const pj = await pr.json().catch(() => null);
    if (!pj || pj.error) {
      return sendError(res, 502, 'The ArcGIS print service returned an error', pj && pj.error);
    }
    const out = (pj.results || []).find((x) => x.paramName === 'Output_File');
    const fileUrl = out && out.value && out.value.url;
    if (!fileUrl) return sendError(res, 502, 'The print service did not return a file', pj);

    // Output files are usually public; if not, retry with the token
    let fr = await fetch(fileUrl, { headers: { Referer: REFERER } });
    if (!fr.ok || !(fr.headers.get('content-type') || '').includes('pdf')) {
      fr = await fetch(fileUrl + (fileUrl.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token),
        { headers: { Referer: REFERER } });
    }
    if (!fr.ok) return sendError(res, 502, `Could not download the finished PDF (${fr.status})`);

    const buf = Buffer.from(await fr.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buf);
  } catch (e) {
    return sendError(res, 500, 'Could not create the map PDF', String(e && e.message || e));
  }
};
