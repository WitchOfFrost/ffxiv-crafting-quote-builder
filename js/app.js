/* Boot + UI wiring: datacenter picker, item autocomplete, buttons. */

let suggestionItems = []; // last results, kept so focus can re-show them
let activeSuggestion = -1;
let searchTimer = null;
let selectedItem = null;
let lastSearchTerm = "";

/* ---------------- datacenter picker ---------------- */
async function initDatacenters() {
  const sel = $("#dcSelect");
  try {
    const dcs = await fetchDatacenters();
    sel.innerHTML = "";
    let region = null,
      group = null;
    for (const dc of dcs) {
      if (dc.region !== region) {
        region = dc.region;
        group = document.createElement("optgroup");
        group.label = region;
        sel.appendChild(group);
      }
      const opt = document.createElement("option");
      opt.value = dc.name;
      opt.textContent = dc.name;
      group.appendChild(opt);
    }
    sel.value = state.dc;
    if (!sel.value) {
      sel.selectedIndex = 0;
      state.dc = sel.value;
    }
  } catch (e) {
    sel.innerHTML = `<option>${state.dc}</option>`;
    toast("Could not load the datacenter list — keeping " + state.dc + ".");
  }

  sel.addEventListener("change", async () => {
    state.dc = sel.value;
    localStorage.setItem("cqb.dc", state.dc);
    state.prices.clear(); // prices are per datacenter
    await refreshPrices();
    renderCraftList();
    saveSession();
  });
}

/* ---------------- item autocomplete ---------------- */
function renderSuggestions(items) {
  const ul = $("#suggestions");
  suggestionItems = items;
  activeSuggestion = -1;
  ul.innerHTML = "";
  if (!items.length) {
    ul.hidden = true;
    return;
  }

  items.forEach((it, i) => {
    const li = document.createElement("li");
    const img = document.createElement("img");
    img.src = iconUrl(it.icon);
    img.alt = "";
    img.decoding = "async";
    img.width = 24;
    img.height = 24;
    const name = document.createElement("span");
    name.textContent = it.name;
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = "#" + it.id;
    li.append(img, name, tag);
    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      pickSuggestion(i);
    });
    ul.appendChild(li);
  });
  ul.hidden = false;
}

function pickSuggestion(i) {
  const it = suggestionItems[i];
  if (!it) return;
  selectedItem = it;
  // the result list intentionally stays open and untouched, so several
  // items from the same search can be added one after another
  addSelectedItem();
}

function highlight(delta) {
  const ul = $("#suggestions");
  if (ul.hidden || !suggestionItems.length) return;
  activeSuggestion =
    (activeSuggestion + delta + suggestionItems.length) %
    suggestionItems.length;
  [...ul.children].forEach((li, i) =>
    li.classList.toggle("active", i === activeSuggestion),
  );
}

/* ---------------- add an item to the craft list ---------------- */
async function addSelectedItem() {
  let item = selectedItem;
  if (!item) {
    const term = $("#itemSearch").value.trim();
    if (!term) return;
    const results = await searchItems(term);
    if (!results.length) {
      toast(`No item found for “${term}”.`);
      return;
    }
    item = results[0];
  }
  const qty = Math.max(1, parseInt($("#itemQty").value, 10) || 1);

  // an item already on the list gains quantity instead of appearing twice
  const existing = state.roots.find((r) => r.item.id === item.id);
  if (existing) {
    await setRootQty(existing.uid, existing.qty + qty);
    toast(`${item.name} → ×${existing.qty}`);
    return;
  }

  $("#addItemBtn").disabled = true;
  $("#craftStatus").textContent = `Loading recipe for ${item.name}…`;
  try {
    const tree = await buildTree(item, qty);
    state.roots.push({ uid: uid(), item, qty, hq: true, tree }); // HQ unless toggled off
    await refreshPrices();
    renderCraftList();
    saveSession();
    if (!tree.children.length)
      toast(`${item.name} has no recipe — added as a plain item.`);
  } catch (e) {
    console.error(e);
    toast("Failed to load that item: " + e.message);
    renderCraftList();
  } finally {
    $("#addItemBtn").disabled = false;
    selectedItem = null;
  }
}

function wireSearch() {
  const input = $("#itemSearch");

  input.addEventListener("input", () => {
    selectedItem = null;
    clearTimeout(searchTimer);
    const term = input.value.trim();
    if (term.length < 2) {
      $("#suggestions").hidden = true;
      return;
    }
    if (term === lastSearchTerm) {
      $("#suggestions").hidden = !suggestionItems.length;
      return;
    }
    searchTimer = setTimeout(async () => {
      try {
        const results = await searchItems(term);
        lastSearchTerm = term;
        renderSuggestions(results);
      } catch (e) {
        console.warn("search failed", e);
      }
    }, 250);
  });

  // coming back to the field re-shows the last result list instead of
  // requiring the term to be edited before anything appears again
  input.addEventListener("focus", () => {
    if (suggestionItems.length && input.value.trim() === lastSearchTerm) {
      $("#suggestions").hidden = false;
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlight(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlight(-1);
    } else if (e.key === "Escape") {
      $("#suggestions").hidden = true;
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeSuggestion >= 0) pickSuggestion(activeSuggestion);
      else addSelectedItem();
    }
  });

  input.addEventListener("blur", () =>
    setTimeout(() => {
      $("#suggestions").hidden = true;
    }, 120),
  );

  $("#addItemBtn").addEventListener("click", addSelectedItem);
  $("#clearCraftBtn").addEventListener("click", () => {
    state.roots = [];
    renderCraftList();
    saveSession();
  });
  $("#collapseAllBtn").addEventListener("click", () =>
    setAllCollapsed(anyExpanded()),
  );
}

/* ---------------- saved setups ---------------- */
function wireSetups() {
  const sel = $("#setupSelect");

  sel.addEventListener("change", async () => {
    $("#deleteSetupBtn").disabled = !sel.value;
    if (!sel.value) return;
    const cfg = loadSetups()[sel.value];
    if (!cfg) return;
    try {
      await applyConfig(cfg);
      saveSession();
      toast(`Loaded “${sel.value}”.`);
    } catch (e) {
      toast("Could not load that setup: " + e.message);
    }
  });

  $("#saveSetupBtn").addEventListener("click", () => {
    const suggested = sel.value || $("#quoteTitle").value.trim() || "Setup";
    const name = (prompt("Save this setup as:", suggested) || "").trim();
    if (name) saveSetup(name);
  });

  $("#deleteSetupBtn").addEventListener("click", () => {
    const name = sel.value;
    if (name && confirm(`Delete the saved setup “${name}”?`)) {
      deleteSetup(name);
      sel.value = "";
      $("#deleteSetupBtn").disabled = true;
    }
  });

  $("#exportJsonBtn").addEventListener("click", exportJSON);
  $("#importJsonBtn").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importJSONFile(file);
    e.target.value = ""; // allow re-importing the same file
  });

  renderSetupList();
}

/* ---------------- boot ---------------- */
async function init() {
  $("#quoteDate").value = new Date().toISOString().slice(0, 10);

  wireSearch();
  wireSetups();
  $("#addRowBtn").addEventListener("click", () => addQuoteRow());
  $("#fillFromCraftBtn").addEventListener("click", fillFromCraftList);
  $("#exportBtn").addEventListener("click", exportPNG);
  ["#quoteTitle", "#quoteFor", "#quoteBy", "#quoteDate", "#quoteNotes"].forEach(
    (sel) => $(sel).addEventListener("input", saveSession),
  );

  renderCraftList();
  await initDatacenters();

  if (!(await restoreSession())) {
    addQuoteRow("Crafting service", "");
    addQuoteRow("Materials", "");
  }
}

document.addEventListener("DOMContentLoaded", init);
