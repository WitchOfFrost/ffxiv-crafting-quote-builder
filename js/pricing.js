/* Turning market listings into what a given quantity actually costs.
   A single cheapest listing is not a price for 20 items — it may hold one
   unit. Every cost here walks the listing book cheapest-first until the
   required amount is covered. */

/**
 * Take listings (cheapest first) until `needed` units are covered.
 * Returns {total, filled, from, to, worlds} — `filled < needed` means the
 * datacenter simply does not have that many on sale.
 */
function fillFrom(listings, needed) {
  let remaining = needed;
  let total = 0;
  let from = null, to = null;
  const worlds = new Set();

  for (const l of listings) {
    if (remaining <= 0) break;
    const take = Math.min(l.qty, remaining);
    total += take * l.ppu;
    remaining -= take;
    if (from === null) from = l.ppu;
    to = l.ppu;
    worlds.add(l.world);
  }
  return { total, filled: needed - remaining, from, to, worlds: [...worlds] };
}

function canBeHq(id) {
  const cached = hqCache.get(id);
  if (cached !== undefined) return cached;
  const book = state.prices.get(id);
  return book ? book.listings.some(l => l.hq) : false;   // fall back to evidence
}

/**
 * Cost of `needed` units of an item.
 * mode 'hq' / 'nq' force a quality, 'auto' prefers HQ and falls back to NQ
 * when HQ cannot cover the amount (or the item has no HQ at all).
 * Returns null when the item has no listings whatsoever.
 */
function costFor(id, needed, mode = 'auto') {
  const book = state.prices.get(id);
  if (!book || !book.listings.length) return null;

  const hq = book.listings.filter(l => l.hq);
  const nq = book.listings.filter(l => !l.hq);

  const build = (listings, quality) => {
    const r = fillFrom(listings, needed);
    return { ...r, quality, needed, short: r.filled < needed };
  };

  if (mode === 'hq') return build(hq, 'HQ');
  if (mode === 'nq') return build(nq, 'NQ');

  // auto: HQ when it can actually cover the requirement
  if (canBeHq(id) && hq.length) {
    const h = build(hq, 'HQ');
    if (!h.short) return h;
    const n = build(nq, 'NQ');
    if (!n.short) return n;
    return h.total >= n.total ? h : n;      // both short — show the better fill
  }
  return build(nq.length ? nq : book.listings, canBeHq(id) ? 'NQ' : '');
}

/** The quality a root item is quoted at — NQ-only items ignore the flag. */
function rootMode(root) {
  if (!canBeHq(root.tree.id)) return 'nq';
  return root.hq ? 'hq' : 'nq';
}

/** Short human label for a cost result, e.g. "700 ea · Moogle". */
function costDetail(cost) {
  if (!cost || !cost.filled) return '';
  const per = cost.from === cost.to ? gil(cost.from) : `${gil(cost.from)}–${gil(cost.to)}`;
  const where = cost.worlds.length === 1 ? ' · ' + cost.worlds[0] : ` · ${cost.worlds.length} worlds`;
  return `${per} ea${where}`;
}
