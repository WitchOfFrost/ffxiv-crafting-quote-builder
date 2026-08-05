/* The reference side: crafting tree, price refresh and its rendering. */

/**
 * Recursively expand an item into its recipe tree.
 * Returns {id, name, icon, qty, isCraft, craftType, yield, children[]}
 * where `qty` is the total amount needed at that node.
 */
async function buildTree(item, qty, depth = 0, seen = new Set()) {
  const node = {
    id: item.id, name: item.name, icon: item.icon,
    qty, children: [], craftType: '', yield: 1, isCraft: false,
  };
  if (depth >= MAX_DEPTH || seen.has(item.id)) return node;   // guard against recipe cycles

  const recipe = await getRecipe(item.id);
  if (!recipe || !recipe.ingredients.length) return node;

  node.isCraft = true;
  node.craftType = recipe.craftType;
  node.yield = recipe.yield;

  const runs = Math.ceil(qty / recipe.yield);
  const nextSeen = new Set(seen).add(item.id);

  node.children = await Promise.all(
    recipe.ingredients.map(ing => buildTree(
      { id: ing.id, name: ing.name, icon: ing.icon },
      ing.amount * runs, depth + 1, nextSeen))
  );
  return node;
}

/** Carry the collapsed flags of an old tree over to a freshly built one. */
function copyCollapsed(from, to) {
  if (!from || !to) return;
  to.collapsed = from.collapsed;
  const byId = new Map(from.children.map(c => [c.id, c]));
  to.children.forEach(c => copyCollapsed(byId.get(c.id), c));
}

/** Change the amount of a root item; rebuilds its tree with the new scaling. */
async function setRootQty(rootUid, qty) {
  const root = state.roots.find(r => r.uid === rootUid);
  if (!root) return;
  root.qty = Math.max(1, qty | 0);
  const tree = await buildTree(root.item, root.qty);
  copyCollapsed(root.tree, tree);
  root.tree = tree;
  await refreshPrices();
  renderCraftList();
  saveSession();
}

function collectIds(node, out = new Set()) {
  out.add(node.id);
  node.children.forEach(c => collectIds(c, out));
  return out;
}

async function refreshPrices() {
  const ids = new Set();
  state.roots.forEach(r => collectIds(r.tree, ids));
  const missing = [...ids].filter(id => !state.prices.has(id));
  await Promise.all([
    missing.length ? fetchPrices(missing) : null,
    refreshSources(),
  ]);
}

/** Cost of the leaves only — the materials you would actually have to buy. */
function leafCost(node) {
  if (node.children.length) return node.children.reduce((s, c) => s + leafCost(c), 0);
  const p = state.prices.get(node.id);
  return p ? p.price * node.qty : 0;
}

/** Cost of simply buying the finished top-level items off the market board. */
function buyoutCost(node) {
  const p = state.prices.get(node.id);
  return p ? p.price * node.qty : 0;
}

/* ---------------- special-source materials ---------------- */

/** A leaf that is neither craftable, gatherable nor sold by a gil vendor. */
function isSpecialSource(node) {
  if (node.children.length) return false;
  const recipe = recipeCache.get(node.id);
  if (recipe && recipe.ingredients.length) return false;   // craftable, just not expanded
  const src = sourceCache.get(node.id);
  if (!src) return false;                                  // unknown — never guess
  return !src.gathered && !src.vendor;
}

/** Look up the origin of every leaf we do not know about yet. */
async function refreshSources() {
  const candidates = new Set();
  state.roots.forEach(r => forEachNode(r.tree, n => {
    if (n.children.length) return;
    const recipe = recipeCache.get(n.id);
    if (recipe && recipe.ingredients.length) return;
    if (!sourceCache.has(n.id)) candidates.add(n.id);
  }));
  if (candidates.size) await fetchSources([...candidates]);
}

/** Aggregate the special materials of one tree into [{id,name,icon,qty}]. */
function tallySpecial(node, into = new Map()) {
  if (isSpecialSource(node)) {
    const e = into.get(node.id) || { id: node.id, name: node.name, icon: node.icon, qty: 0 };
    e.qty += node.qty;
    into.set(node.id, e);
  }
  node.children.forEach(c => tallySpecial(c, into));
  return into;
}

/** True when some node in the tree has no listing, so a total is understated. */
function hasMissingPrice(node) {
  if (!node.children.length) return !state.prices.get(node.id);
  return node.children.some(hasMissingPrice);
}

/* ---------------- rendering ---------------- */
function nodeEl(node, isRoot, onRemove, rootUid) {
  const wrap = document.createElement('div');
  const row = document.createElement('div');
  row.className = 'node' + (isRoot ? ' root' : '');

  const twist = document.createElement('span');
  twist.className = 'twist' + (node.children.length ? '' : ' leaf');
  twist.textContent = node.children.length ? (node.collapsed ? '▸' : '▾') : '•';
  row.appendChild(twist);

  const img = document.createElement('img');
  img.src = iconUrl(node.icon);
  img.alt = '';
  img.loading = 'lazy';
  row.appendChild(img);

  const name = document.createElement('span');
  name.textContent = node.name;
  if (node.isCraft) {
    const b = document.createElement('span');
    b.className = 'badge-craft';
    b.textContent = node.craftType || 'craft';
    name.appendChild(b);
  }
  row.appendChild(name);

  if (isRoot) {
    // roots are editable: changing the amount rescales the whole tree
    const box = document.createElement('span');
    box.className = 'qty qty-edit';
    const mul = document.createElement('span');
    mul.textContent = '×';
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.value = node.qty;
    input.addEventListener('change', () => {
      const n = Math.max(1, parseInt(input.value, 10) || 1);
      input.value = n;
      setRootQty(rootUid, n);
    });
    box.append(mul, input);
    row.appendChild(box);
  } else {
    const qty = document.createElement('span');
    qty.className = 'qty';
    qty.textContent = '×' + node.qty;
    row.appendChild(qty);
  }

  const price = document.createElement('span');
  const p = state.prices.get(node.id);
  if (p) {
    price.className = 'price';
    price.innerHTML = `${gil(p.price * node.qty)} <small>gil</small>`
      + (p.world ? `<br><small>${gil(p.price)} ea · ${p.world}${p.hq ? ' HQ' : ''}</small>` : '');
  } else {
    price.className = 'price none';
    price.innerHTML = '<small>no listing</small>';
  }
  row.appendChild(price);

  if (isRoot) {
    const rm = document.createElement('button');
    rm.className = 'rm';
    rm.title = 'Remove';
    rm.textContent = '✕';
    rm.addEventListener('click', onRemove);
    row.appendChild(rm);
  }

  wrap.appendChild(row);

  if (node.children.length) {
    const kids = document.createElement('div');
    // `collapsed` lives on the node itself, so the open/closed state survives
    // a re-render (adding another item must not reopen everything).
    kids.className = 'children' + (node.collapsed ? ' collapsed' : '');
    node.children.forEach(c => kids.appendChild(nodeEl(c, false)));
    wrap.appendChild(kids);
    twist.addEventListener('click', () => {
      node.collapsed = !node.collapsed;
      kids.classList.toggle('collapsed', node.collapsed);
      twist.textContent = node.collapsed ? '▸' : '▾';
      updateCollapseAllBtn();
    });
  }
  return wrap;
}

/* ---------------- collapse / expand all ---------------- */
function forEachNode(node, fn) {
  fn(node);
  node.children.forEach(c => forEachNode(c, fn));
}

function anyExpanded() {
  let found = false;
  state.roots.forEach(r => forEachNode(r.tree, n => {
    if (n.children.length && !n.collapsed) found = true;
  }));
  return found;
}

function setAllCollapsed(collapsed) {
  state.roots.forEach(r => forEachNode(r.tree, n => {
    if (n.children.length) n.collapsed = collapsed;
  }));
  renderCraftList();
}

function updateCollapseAllBtn() {
  const btn = $('#collapseAllBtn');
  if (!btn) return;
  const hasBranches = state.roots.some(r => r.tree.children.length);
  btn.disabled = !hasBranches;
  btn.textContent = anyExpanded() ? 'Collapse all' : 'Expand all';
}

function renderCraftList() {
  const host = $('#craftList');
  host.innerHTML = '';
  state.roots.forEach(root => {
    host.appendChild(nodeEl(root.tree, true, () => {
      state.roots = state.roots.filter(r => r.uid !== root.uid);
      renderCraftList();
      saveSession();
    }, root.uid));
  });

  const buyout = state.roots.reduce((s, r) => s + buyoutCost(r.tree), 0);
  const materials = state.roots.reduce((s, r) => s + leafCost(r.tree), 0);
  const buyoutPartial = state.roots.some(r => !state.prices.get(r.tree.id));
  const matPartial = state.roots.some(r => hasMissingPrice(r.tree));

  $('#refBuyTotal').textContent = gil(buyout) + ' gil' + (buyoutPartial ? '*' : '');
  $('#refTotal').textContent = gil(materials) + ' gil' + (matPartial ? '*' : '');
  $('#refPartial').hidden = !(buyoutPartial || matPartial);
  $('#craftStatus').textContent = state.roots.length
    ? `${state.roots.length} item${state.roots.length > 1 ? 's' : ''} in the craft list`
    : 'No items yet.';
  updateCollapseAllBtn();
  renderSpecial();
}

/* ---------------- special-source section ---------------- */
function specialRow(entry, indent) {
  const row = document.createElement('div');
  row.className = 'sp-row' + (indent ? ' indent' : '');

  const img = document.createElement('img');
  img.src = iconUrl(entry.icon);
  img.alt = '';
  img.loading = 'lazy';

  const name = document.createElement('span');
  name.className = 'sp-name';
  name.textContent = entry.name;

  const qty = document.createElement('span');
  qty.className = 'sp-qty';
  qty.textContent = '×' + entry.qty;

  const price = document.createElement('span');
  price.className = 'sp-price';
  const p = state.prices.get(entry.id);
  price.innerHTML = p ? `${gil(p.price * entry.qty)} <small>gil</small>` : '<small>no listing</small>';

  row.append(img, name, qty, price);
  return row;
}

function renderSpecial() {
  const body = $('#specialBody');
  const summary = $('#specialSummary');
  if (!body) return;
  body.innerHTML = '';

  const combined = new Map();
  const perRoot = state.roots.map(r => {
    const tally = tallySpecial(r.tree);
    tally.forEach(e => {
      const c = combined.get(e.id) || { ...e, qty: 0 };
      c.qty += e.qty;
      combined.set(e.id, c);
    });
    return { root: r, entries: [...tally.values()] };
  }).filter(x => x.entries.length);

  if (!combined.size) {
    summary.textContent = state.roots.length ? '— none' : '';
    const p = document.createElement('p');
    p.className = 'sp-empty';
    p.textContent = state.roots.length
      ? 'Everything on the list can be gathered, crafted or bought from a gil vendor.'
      : 'Add an item to see what needs to be procured.';
    body.appendChild(p);
    return;
  }

  const kinds = combined.size;
  summary.textContent = `— ${kinds} item type${kinds > 1 ? 's' : ''} to procure`;

  const head = document.createElement('div');
  head.className = 'sp-head';
  head.textContent = 'Total to procure';
  body.appendChild(head);
  [...combined.values()].forEach(e => body.appendChild(specialRow(e, false)));

  // per crafted item, so the customer can see what each one costs them
  perRoot.forEach(({ root, entries }) => {
    const h = document.createElement('div');
    h.className = 'sp-head sub';
    h.textContent = `for ${root.qty}× ${root.tree.name}`;
    body.appendChild(h);
    entries.forEach(e => body.appendChild(specialRow(e, true)));
  });
}
