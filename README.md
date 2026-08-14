# FFXIV Crafting Quote Builder

A small browser app for putting together crafting quotes for FINAL FANTASY XIV.
Search an item, expand its recipe and precrafts, see the cheapest market prices on
your datacenter, then write a clean quote and export it as a PNG.

No build step, no dependencies — plain HTML, CSS and JavaScript.

## Features

- **Item search** against [XIVAPI v2](https://v2.xivapi.com/) with icons and keyboard navigation
- **Recursive precraft expansion** with quantities scaled by recipe yield (`ceil(qty / AmountResult)`)
- **Cheapest market listings** per datacenter from [Universalis](https://docs.universalis.app/),
  shown per node with the world it sits on
- **Two reference totals** — buying the finished items outright vs. the cheapest material cost
- **Special-source materials** — a separate, collapsible tally of everything that can be neither
  gathered, crafted nor bought from a gil vendor (tomestone/scrip purchases, aetherial reduction,
  drops …), so the customer knows what they can procure themselves
- **Editable quote table** — position, description, price, with a running total
- **Saved setups** in browser storage, plus JSON import/export
- **PNG export** of the quote, including a market-board reference block

## Build

There is no build step for development — the source runs as-is. The deploy workflow does two
things to the published copy only:

1. minifies `css/*.css` and `js/*.js` with esbuild (no bundling, so the classic scripts keep
   sharing their globals);
2. runs `tools/inline-css.py`, which replaces the `<link ... data-inline>` tags in `index.html`
   with `<style>` blocks.

The CSS is under 3 KB gzipped, which is cheaper to inline than to fetch: it removes a
render-blocking request and any layout shift from late-arriving styles. Loading the component
sheet asynchronously instead was measured at CLS 0.60 versus 0 when inlined.

## Caching

GitHub Pages serves every file with a fixed `Cache-Control: max-age=600` and ignores `_headers`
files, so the TTL cannot be raised from this repo. `sw.js` handles it client-side instead:

- navigations are **network first** (a deploy is picked up immediately, and the app still opens
  offline);
- static files are **stale-while-revalidate** (served from cache, refreshed in the background);
- XIVAPI and Universalis requests are never intercepted — prices must always be live.

The cache name is stamped with the commit SHA at deploy time, so each deploy creates a fresh cache
and old ones are deleted on activation. Nothing needs bumping by hand.

## Running locally

Open `index.html` in a browser — the scripts are classic scripts, so `file://` works.
If your browser is strict about local files, serve the folder instead:

```sh
python -m http.server 8000     # then open http://localhost:8000
```

## Deploying to GitHub Pages

The repository root is the site; `.github/workflows/deploy.yml` publishes it on every
push to `main`.

1. Create a repository on GitHub and push this folder:

   ```sh
   git init
   git add .
   git commit -m "FFXIV crafting quote builder"
   git branch -M main
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```

2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push (or run the workflow manually from the Actions tab). The site appears at
   <https://witchoffrost.github.io/ffxiv-crafting-quote-builder/>.

If the site ever moves to a different repo name or a custom domain, update the absolute URLs in
`index.html` (canonical, `og:url`, `og:image`, JSON-LD), `sitemap.xml` and `robots.txt`.

### Search engine setup

- `googlee7cc0fe994c7987a.html` is the Google Search Console verification file and must stay at the
  repository root, untouched.
- Submit `sitemap.xml` in Search Console (the URL-prefix property prefills the site path). If it
  reports "could not be fetched" with an empty "last read", the usual cause is that it was submitted
  before the Pages deployment finished — resubmit once the file is live and it will be read.
- `robots.txt` is only honoured at the host root (`witchoffrost.github.io/robots.txt`), which belongs
  to a user-site repo that does not exist here. The copy in this repo is therefore informational; no
  robots.txt at all means "crawl everything", so the sitemap submission above is what matters.
- `assets/og-image.png` (1200×630) is the link preview image, regenerated only if the branding changes.

All asset paths are relative, so the app works from a project subpath without configuration.
Both APIs are HTTPS and send permissive CORS headers, so they work directly from Pages —
there is no server component and no API key.

## Project layout

| Path               | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `index.html`       | Markup for the reference and quote panels            |
| `css/shell.css`    | Critical styles: reset, layout, top bar, form controls |
| `css/components.css` | Craft list, quote table, special-source section, about, footer |
| `tools/inline-css.py` | Deploy step that inlines both sheets into `index.html` |
| `js/core.js`       | Shared state and helpers                             |
| `js/api.js`        | XIVAPI (items, recipes, item sources) and Universalis |
| `js/craftlist.js`  | Crafting tree, totals, special-source tally          |
| `js/quote.js`      | Quote table                                          |
| `js/storage.js`    | Autosave, saved setups, JSON import/export           |
| `js/export.js`     | Canvas PNG export                                    |
| `js/app.js`        | Boot and UI wiring                                   |

## License

[MIT](LICENSE) © 2026 WitchOfFrost — free to use, modify and redistribute, provided the
copyright notice and license text are kept with any copy or substantial portion of the
software.

## Disclaimer

Not affiliated with Square Enix. FINAL FANTASY XIV © SQUARE ENIX CO., LTD.
Game data comes from XIVAPI, market data from Universalis.

## Double Disclaimer
This thing is completely vibecoded to give me a personal, suited-to-my-needs UI for creating quotes.
There are probably a lot of issues or QoL improvements possible in this, but as long as I do not care enough, I will not change it.
If you feel something is missing, broken or could be done better, create your own fork and either fix and PR, or just keep it for yourself. I couldn't care less. 