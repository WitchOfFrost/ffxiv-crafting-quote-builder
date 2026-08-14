/* The quote side: an editable position / description / price table. */

/** Price is per unit; the line amount is unit price × quantity. */
function rowAmount(row) {
  return (Number(row.price) || 0) * (Number(row.qty) || 0);
}

function quoteTotal() {
  return state.quote.reduce((s, r) => s + rowAmount(r), 0);
}

function updateQuoteTotal() {
  $("#quoteTotal").textContent = gil(quoteTotal());
}

function addQuoteRow(desc = "", price = "", qty = 1) {
  state.quote.push({ desc, price, qty });
  renderQuote();
  saveSession();
}

function renderQuote() {
  const body = $("#quoteBody");
  body.innerHTML = "";

  state.quote.forEach((row, i) => {
    const tr = document.createElement("tr");

    const pos = document.createElement("td");
    pos.textContent = i + 1;
    tr.appendChild(pos);

    const desc = document.createElement("td");
    const dIn = document.createElement("input");
    dIn.type = "text";
    dIn.value = row.desc;
    dIn.placeholder = "Description";
    dIn.setAttribute("aria-label", `Position ${i + 1} description`);
    dIn.addEventListener("input", () => {
      row.desc = dIn.value;
      saveSession();
    });
    desc.appendChild(dIn);
    tr.appendChild(desc);

    const amount = document.createElement("td");
    amount.className = "amount";

    const qty = document.createElement("td");
    const qIn = document.createElement("input");
    qIn.type = "number";
    qIn.className = "qty";
    qIn.min = "1";
    qIn.setAttribute("aria-label", `Position ${i + 1} quantity`);
    qIn.value = row.qty;
    qIn.addEventListener("input", () => {
      const n = parseInt(qIn.value, 10);
      row.qty = Number.isFinite(n) && n > 0 ? n : "";
      amount.textContent = gil(rowAmount(row));
      updateQuoteTotal();
      saveSession();
    });
    qIn.addEventListener("blur", () => {
      if (!row.qty) {
        row.qty = 1;
        qIn.value = 1;
        amount.textContent = gil(rowAmount(row));
        updateQuoteTotal();
      }
    });
    qty.appendChild(qIn);
    tr.appendChild(qty);

    const price = document.createElement("td");
    const pIn = document.createElement("input");
    pIn.type = "text";
    pIn.className = "price";
    pIn.value = row.price === "" ? "" : gil(row.price);
    pIn.placeholder = "0";
    pIn.setAttribute("aria-label", `Position ${i + 1} unit price`);
    pIn.addEventListener("input", () => {
      const n = parseInt(pIn.value.replace(/[^0-9]/g, ""), 10);
      row.price = Number.isFinite(n) ? n : "";
      amount.textContent = gil(rowAmount(row));
      updateQuoteTotal();
      saveSession();
    });
    pIn.addEventListener("blur", () => {
      pIn.value = row.price === "" ? "" : gil(row.price);
    });
    price.appendChild(pIn);
    tr.appendChild(price);

    amount.textContent = gil(rowAmount(row));
    tr.appendChild(amount);

    const del = document.createElement("td");
    const btn = document.createElement("button");
    btn.className = "row-del";
    btn.textContent = "✕";
    btn.title = "Remove row";
    btn.addEventListener("click", () => {
      state.quote.splice(i, 1);
      renderQuote();
      saveSession();
    });
    del.appendChild(btn);
    tr.appendChild(del);

    body.appendChild(tr);
  });

  updateQuoteTotal();
}

/** Convenience: seed the quote with one line per item in the craft list. */
function fillFromCraftList() {
  if (!state.roots.length) {
    toast("Craft list is empty.");
    return;
  }
  state.roots.forEach((r) => {
    const desc = r.tree.name;
    const existing = state.quote.find((q) => q.desc === desc);
    if (existing)
      existing.qty = r.qty; // keep the amount in step
    else state.quote.push({ desc, price: "", qty: r.qty });
  });
  renderQuote();
  saveSession();
}
