# EPPS Gas Storage Project — Acquisition Dashboard

A single self-contained HTML file (`index.html`) — no build step, no dependencies to install.
All data, styling, and logic live inline in the one file.

## One-time setup

1. **Create the GitHub repo** (if you haven't already):
   ```
   git init
   git add .
   git commit -m "Initial dashboard"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```

2. **Link it to Vercel**:
   - In the Vercel dashboard: **Add New → Project → Import** the GitHub repo
   - Framework preset: choose **Other** (this is a plain static file, not a framework app)
   - Leave build command and output directory blank — there's nothing to build
   - Deploy

   Vercel automatically serves `index.html` at your project's root URL, so the dashboard will be live at something like `https://<your-project>.vercel.app` right after the first deploy.

## Weekly update workflow (going forward)

1. Send the new mapper export Excel to Claude, same as always
2. Claude updates `index.html` and hands you the file back
3. Replace the local `index.html` with the updated version, then:
   ```
   git add index.html
   git commit -m "Weekly update: <date>"
   git push
   ```
4. Vercel auto-deploys the change within a minute or two — no manual upload step needed

## Notes

- The live ArcGIS map embed in this dashboard needs the page to be served over a real `https://` origin (not opened as a local file) for its status-filter integration to work — this is exactly what Vercel hosting provides, and was the blocker when testing locally or via FileCloud.
- If you ever want a preview before it goes live on your main URL, Vercel automatically creates a unique preview deployment for every branch/PR — useful for sanity-checking a change before merging to `main`.
