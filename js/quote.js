/* The quote side: an editable position / description / price table. */

function quoteTotal() {
  return state.quote.reduce((s, r) => s + (Number(r.price) || 0), 0);
}

function updateQuoteTotal() {
  $('#quoteTotal').textContent = gil(quoteTotal());
}

function addQuoteRow(desc = '', price = '') {
  state.quote.push({ desc, price });
  renderQuote();
  saveSession();
}

function renderQuote() {
  const body = $('#quoteBody');
  body.innerHTML = '';

  state.quote.forEach((row, i) => {
    const tr = document.createElement('tr');

    const pos = document.createElement('td');
    pos.textContent = i + 1;
    tr.appendChild(pos);

    const desc = document.createElement('td');
    const dIn = document.createElement('input');
    dIn.type = 'text';
    dIn.value = row.desc;
    dIn.placeholder = 'Description';
    dIn.addEventListener('input', () => { row.desc = dIn.value; saveSession(); });
    desc.appendChild(dIn);
    tr.appendChild(desc);

    const price = document.createElement('td');
    const pIn = document.createElement('input');
    pIn.type = 'text';
    pIn.className = 'price';
    pIn.value = row.price === '' ? '' : gil(row.price);
    pIn.placeholder = '0';
    pIn.addEventListener('input', () => {
      const n = parseInt(pIn.value.replace(/[^0-9]/g, ''), 10);
      row.price = Number.isFinite(n) ? n : '';
      updateQuoteTotal();
      saveSession();
    });
    pIn.addEventListener('blur', () => { pIn.value = row.price === '' ? '' : gil(row.price); });
    price.appendChild(pIn);
    tr.appendChild(price);

    const del = document.createElement('td');
    const btn = document.createElement('button');
    btn.className = 'row-del';
    btn.textContent = '✕';
    btn.title = 'Remove row';
    btn.addEventListener('click', () => { state.quote.splice(i, 1); renderQuote(); saveSession(); });
    del.appendChild(btn);
    tr.appendChild(del);

    body.appendChild(tr);
  });

  updateQuoteTotal();
}

/** Convenience: seed the quote with one line per item in the craft list. */
function fillFromCraftList() {
  if (!state.roots.length) { toast('Craft list is empty.'); return; }
  state.roots.forEach(r => {
    const desc = r.qty > 1 ? `${r.qty}× ${r.tree.name}` : r.tree.name;
    if (!state.quote.some(q => q.desc === desc)) state.quote.push({ desc, price: '' });
  });
  renderQuote();
  saveSession();
}
