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
   `https://<user>.github.io/<repo>/`.

All asset paths are relative, so the app works from a project subpath without configuration.
Both APIs are HTTPS and send permissive CORS headers, so they work directly from Pages —
there is no server component and no API key.

## Project layout

| Path               | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `index.html`       | Markup for the reference and quote panels            |
| `styles.css`       | Styling                                              |
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