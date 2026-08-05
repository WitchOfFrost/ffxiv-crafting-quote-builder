/* All network access: XIVAPI v2 (items + recipes) and Universalis (prices). */

const recipeCache = new Map();   // itemId -> recipe | null

/* ---------------- XIVAPI: item search ---------------- */
async function searchItems(term) {
  const q = term.replace(/["\\]/g, ' ').trim();
  if (!q) return [];
  const url = `${XIVAPI}/search?sheets=Item&query=Name~"${encodeURIComponent(q)}"`
            + `&fields=Name,Icon&limit=50`;
  const data = await getJSON(url);
  return (data.results || [])
    .filter(r => r.fields && r.fields.Name)
    .map(r => ({ id: r.row_id, name: r.fields.Name, icon: r.fields.Icon }));
}

/* ---------------- XIVAPI: recipe for a result item ---------------- */
async function getRecipe(itemId) {
  if (recipeCache.has(itemId)) return recipeCache.get(itemId);

  const url = `${XIVAPI}/search?sheets=Recipe&query=ItemResult=${itemId}`
            + `&fields=AmountResult,AmountIngredient,Ingredient[].Name,Ingredient[].Icon,CraftType.Name&limit=1`;
  let recipe = null;
  try {
    const data = await getJSON(url);
    const row = (data.results || [])[0];
    if (row) {
      const f = row.fields;
      const ingredients = [];
      // Ingredient/AmountIngredient are parallel fixed-length arrays padded with zeros.
      (f.Ingredient || []).forEach((ing, i) => {
        const amount = (f.AmountIngredient || [])[i] || 0;
        if (!ing || !ing.row_id || !amount) return;
        ingredients.push({
          id: ing.row_id,
          name: (ing.fields && ing.fields.Name) || `#${ing.row_id}`,
          icon: ing.fields && ing.fields.Icon,
          amount,
        });
      });
      recipe = {
        yield: f.AmountResult || 1,
        craftType: (f.CraftType && f.CraftType.fields && f.CraftType.fields.Name) || '',
        ingredients,
      };
    }
  } catch (e) {
    console.warn('recipe lookup failed for', itemId, e);
  }

  recipeCache.set(itemId, recipe);
  return recipe;
}

/* ---------------- XIVAPI: where does an item come from? ----------------
   An item counts as "special source" when it is none of the following:
     craftable  — has a Recipe (already known from the recipe cache)
     gathered   — GatheringItem (mining/botany), FishParameter, SpearfishingItem
     vendor     — GilShopItem, i.e. buyable from an NPC for plain gil
   Everything left over (tomestone/scrip purchases, aethersand reduction,
   drops, beast tribes, treasure maps …) is something the customer has to
   procure by other means, which is exactly what we want to list.          */

const SOURCE_SHEETS = 'GatheringItem,FishParameter,SpearfishingItem,GilShopItem';
const GATHER_SHEETS = new Set(['GatheringItem', 'FishParameter', 'SpearfishingItem']);
const sourceCache = new Map();   // itemId -> {gathered, vendor}

async function searchSourceChunk(ids, limit = 100) {
  const query = ids.map(id => `Item=${id}`).join(' ');   // space = OR
  const url = `${XIVAPI}/search?sheets=${SOURCE_SHEETS}`
            + `&query=${encodeURIComponent(query)}&fields=Item%40as(raw)&limit=${limit}`;
  const data = await getJSON(url);
  const results = data.results || [];

  // A single vendor item can occupy dozens of GilShopItem rows. If the result
  // set is saturated another id may have been crowded out, so split and retry.
  if (results.length >= limit && ids.length > 1) {
    const mid = Math.ceil(ids.length / 2);
    const [a, b] = await Promise.all([
      searchSourceChunk(ids.slice(0, mid), limit),
      searchSourceChunk(ids.slice(mid), limit),
    ]);
    return a.concat(b);
  }
  return results;
}

async function fetchSources(ids) {
  const CHUNK = 8;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    try {
      const results = await searchSourceChunk(chunk);
      const found = new Map(chunk.map(id => [id, { gathered: false, vendor: false }]));
      for (const r of results) {
        const id = r.fields && r.fields['Item@as(raw)'];
        const entry = found.get(id);
        if (!entry) continue;
        if (GATHER_SHEETS.has(r.sheet)) entry.gathered = true;
        else if (r.sheet === 'GilShopItem') entry.vendor = true;
      }
      found.forEach((v, id) => sourceCache.set(id, v));
    } catch (e) {
      // leave uncached so it is retried rather than mislabelled as special
      console.warn('source lookup failed', e);
    }
  }
}

/* ---------------- Universalis: cheapest listing on the DC ---------------- */
async function fetchPrices(ids) {
  for (let i = 0; i < ids.length; i += PRICE_CHUNK) {
    const chunk = ids.slice(i, i + PRICE_CHUNK);
    const url = `${UNIVERSALIS}/${encodeURIComponent(state.dc)}/${chunk.join(',')}?listings=1&entries=0`;
    try {
      const data = await getJSON(url);
      // A single-id request returns the item object itself instead of {items:{…}}.
      const items = data.items || { [data.itemID]: data };
      for (const id of chunk) {
        const it = items[id];
        if (!it) { state.prices.set(id, null); continue; }
        const cheapest = (it.listings || [])[0];
        if (cheapest) {
          state.prices.set(id, {
            price: cheapest.pricePerUnit,
            world: cheapest.worldName || '',
            hq: !!cheapest.hq,
          });
        } else if (it.minPrice) {
          state.prices.set(id, { price: it.minPrice, world: '', hq: false });
        } else {
          state.prices.set(id, null);   // untradable, or nothing on the market
        }
      }
    } catch (e) {
      console.warn('price lookup failed', e);
      chunk.forEach(id => { if (!state.prices.has(id)) state.prices.set(id, null); });
    }
  }
}

/* ---------------- Universalis: datacenter list ---------------- */
async function fetchDatacenters() {
  const dcs = await getJSON(`${UNIVERSALIS}/data-centers`);
  return dcs.sort((a, b) => a.region.localeCompare(b.region) || a.name.localeCompare(b.name));
}
