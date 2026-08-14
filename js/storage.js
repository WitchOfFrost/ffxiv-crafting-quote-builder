/* Persistence: autosaved session, named setups in localStorage, JSON import/export. */

const SESSION_KEY = "cqb.session";
const SETUPS_KEY = "cqb.setups";

/* ---------------- (de)serialisation ---------------- */
function serialize() {
  return {
    format: "ffxiv-crafting-quote",
    version: 1,
    savedAt: new Date().toISOString(),
    dc: state.dc,
    // only the seed items are stored — trees are rebuilt from the live recipes
    items: state.roots.map((r) => ({
      id: r.item.id,
      name: r.item.name,
      icon: r.item.icon,
      qty: r.qty,
      hq: r.hq !== false,
    })),
    quote: state.quote.map((q) => ({
      desc: q.desc,
      price: q.price,
      qty: q.qty,
    })),
    meta: {
      title: $("#quoteTitle").value,
      for: $("#quoteFor").value,
      by: $("#quoteBy").value,
      date: $("#quoteDate").value,
      notes: $("#quoteNotes").value,
    },
  };
}

async function applyConfig(cfg) {
  if (!cfg || typeof cfg !== "object")
    throw new Error("not a valid setup file");

  if (cfg.dc) {
    state.dc = cfg.dc;
    localStorage.setItem("cqb.dc", state.dc);
    const sel = $("#dcSelect");
    if (sel && [...sel.options].some((o) => o.value === cfg.dc))
      sel.value = cfg.dc;
    state.prices.clear();
  }

  const m = cfg.meta || {};
  if (m.title !== undefined) $("#quoteTitle").value = m.title;
  if (m.for !== undefined) $("#quoteFor").value = m.for;
  if (m.by !== undefined) $("#quoteBy").value = m.by;
  if (m.date !== undefined) $("#quoteDate").value = m.date;
  if (m.notes !== undefined) $("#quoteNotes").value = m.notes;

  state.quote = (cfg.quote || []).map((q) => ({
    desc: q.desc || "",
    price:
      q.price === "" || q.price === null || q.price === undefined
        ? ""
        : Number(q.price),
    qty: Math.max(1, Number(q.qty) || 1), // setups saved before quantities existed default to 1
  }));
  renderQuote();

  state.roots = [];
  renderCraftList();
  for (const it of cfg.items || []) {
    const item = { id: it.id, name: it.name, icon: it.icon };
    const qty = Math.max(1, it.qty | 0 || 1);
    const tree = await buildTree(item, qty);
    state.roots.push({ uid: uid(), item, qty, hq: it.hq !== false, tree });
  }
  await refreshPrices();
  renderCraftList();
}

/* ---------------- autosaved session ---------------- */
let saveTimer = null;
function saveSession() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(serialize()));
    } catch (e) {
      console.warn("session save failed", e);
    }
  }, 300);
}

async function restoreSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return false;
  try {
    await applyConfig(JSON.parse(raw));
    return true;
  } catch (e) {
    console.warn("session restore failed", e);
    return false;
  }
}

/* ---------------- named setups ---------------- */
function loadSetups() {
  try {
    return JSON.parse(localStorage.getItem(SETUPS_KEY)) || {};
  } catch {
    return {};
  }
}

function writeSetups(setups) {
  localStorage.setItem(SETUPS_KEY, JSON.stringify(setups));
  renderSetupList();
}

function saveSetup(name) {
  const setups = loadSetups();
  setups[name] = serialize();
  writeSetups(setups);
  $("#setupSelect").value = name;
  toast(`Saved “${name}”.`);
}

function deleteSetup(name) {
  const setups = loadSetups();
  if (!(name in setups)) return;
  delete setups[name];
  writeSetups(setups);
  toast(`Deleted “${name}”.`);
}

function renderSetupList() {
  const sel = $("#setupSelect");
  const current = sel.value;
  const names = Object.keys(loadSetups()).sort((a, b) => a.localeCompare(b));
  sel.innerHTML = '<option value="">Saved setups…</option>';
  names.forEach((n) => {
    const o = document.createElement("option");
    o.value = n;
    o.textContent = n;
    sel.appendChild(o);
  });
  if (names.includes(current)) sel.value = current;
  $("#deleteSetupBtn").disabled = !sel.value;
}

/* ---------------- JSON file import / export ---------------- */
function exportJSON() {
  const cfg = serialize();
  const name = ($("#setupSelect").value || $("#quoteTitle").value || "quote")
    .replace(/[^\w\-]+/g, "_")
    .toLowerCase();
  const blob = new Blob([JSON.stringify(cfg, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name || "quote"}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast("JSON exported.");
}

async function importJSONFile(file) {
  try {
    const cfg = JSON.parse(await file.text());
    await applyConfig(cfg);
    saveSession();
    toast("Setup imported.");
  } catch (e) {
    console.error(e);
    toast("Import failed: " + e.message);
  }
}
