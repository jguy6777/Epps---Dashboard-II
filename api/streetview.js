// Street View photo for the landowner popup.
//
//   GET /api/streetview?lat=..&lng=..&meta=1  -> JSON: nearest Street View panorama to the tract
//                                                (Google's metadata lookup is free / unbilled)
//   GET /api/streetview?lat=..&lng=..&heading=..  -> the JPEG photo itself
//
// Needs a Google Maps Platform key with the "Street View Static API" enabled, saved in Vercel
// as the environment variable GOOGLE_MAPS_API_KEY. Until that's set this returns 501 and the
// dashboard just shows its "Open in Street View" link instead of a photo.
// The key never reaches the browser. Requests are limited to the EPPS project area so the
// endpoint can't be used as a general-purpose Street View proxy.

const BOUNDS = { minLat: 31.5, maxLat: 33.8, minLng: -92.8, maxLng: -90.2 };
const SEARCH_RADIUS_M = 400; // how far from the tract to look for road imagery

module.exports = async (req, res) => {
  const key = (process.env.GOOGLE_MAPS_API_KEY || '').trim();
  if (!key) return res.status(501).json({ error: 'GOOGLE_MAPS_API_KEY is not set' });

  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (!isFinite(lat) || !isFinite(lng) ||
      lat < BOUNDS.minLat || lat > BOUNDS.maxLat || lng < BOUNDS.minLng || lng > BOUNDS.maxLng) {
    return res.status(400).json({ error: 'Location outside the project area' });
  }
  const loc = `${lat.toFixed(6)},${lng.toFixed(6)}`;

  try {
    if (req.query.meta) {
      const u = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${loc}` +
                `&radius=${SEARCH_RADIUS_M}&source=outdoor&key=${encodeURIComponent(key)}`;
      const m = await (await fetch(u)).json();
      res.setHeader('Cache-Control', 'public, max-age=86400');
      if (m.status !== 'OK') return res.status(200).json({ status: m.status });
      return res.status(200).json({ status: 'OK', lat: m.location.lat, lng: m.location.lng, date: m.date || null });
    }

    const heading = parseFloat(req.query.heading);
    const u = `https://maps.googleapis.com/maps/api/streetview?size=640x320&scale=1&fov=80&pitch=0` +
              `&location=${loc}&radius=${SEARCH_RADIUS_M}&source=outdoor` +
              (isFinite(heading) ? `&heading=${heading.toFixed(1)}` : '') +
              `&return_error_code=true&key=${encodeURIComponent(key)}`;
    const r = await fetch(u);
    if (!r.ok) return res.status(404).json({ error: 'No Street View image here' });
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach Google', detail: String(e) });
  }
};
