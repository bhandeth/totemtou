# Totemtou

Static website for [Totemtou](https://totemtou.com) — curated Himalayan adventures, led with experience.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Main landing page |
| `abc_journey_3.html` | Annapurna Base Camp journey page |
| `khopra_journey.html` | Khopra Ridge & Khayer Lake journey page |
| `cms.html` | Internal CMS — manage trips, hero video, and content |

## Making edits

### Option A — Edit directly on GitHub (simplest)

1. Open the file you want to change on [github.com/bhandeth/totemtou](https://github.com/bhandeth/totemtou)
2. Click the pencil icon (Edit this file) in the top right
3. Make your changes
4. Scroll down → click **Commit changes**
5. Vercel will auto-deploy within ~30 seconds

### Option B — Edit locally

1. Clone the repo (first time only):
   ```bash
   git clone https://github.com/bhandeth/totemtou.git
   cd totemtou
   ```

2. Make your changes to any HTML file using a code editor (VS Code recommended)

3. Push the changes:
   ```bash
   git add .
   git commit -m "Brief description of what you changed"
   git push
   ```

4. Vercel auto-deploys on every push — live in ~30 seconds

## Content managed via CMS

The following content is managed through `cms.html` and stored in the browser's local storage — no code edits needed:

- **Hero video** — the background video on the landing page
- **Journey cards** — visibility, images, titles, stats, and ordering of trips

Open `cms.html` locally or via the deployed URL to make these changes.

## Changelog

| Date | Change |
|------|--------|
| 2026-05-01 | Fixed Khopra Ridge & Khayer Lake card link — now points to `khopra_journey.html` instead of `#` |

## Adding a new journey page

1. Duplicate an existing journey file (e.g. `abc_journey_3.html`) and rename it
2. Edit the content inside
3. Register the new page in `index.html` inside the `TRIP_URLS` object in the script at the bottom:
   ```js
   const TRIP_URLS = {
     abc: 'abc_journey_3.html',
     your_new_id: 'your_new_page.html',  // add this line
   };
   ```
4. Commit and push
