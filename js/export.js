/* PNG export — the quote is painted onto a canvas and downloaded.
   Drawn by hand rather than screenshotting the DOM: no dependencies,
   and the exported sheet can look different from the dark editor UI. */

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function ellipsize(ctx, text, maxWidth) {
  let s = String(text);
  if (ctx.measureText(s).width <= maxWidth) return s;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxWidth)
    s = s.slice(0, -1);
  return s + "…";
}

function exportPNG() {
  const W = 900,
    PAD = 40,
    SCALE = 2,
    LINE_H = 22,
    ROW_PAD = 10;
  const C = {
    bg: "#ffffff",
    text: "#141821",
    muted: "#6b7280",
    line: "#d7dbe3",
    head: "#eef1f6",
    accent: "#2f4b8f",
  };

  const canvas = $("#exportCanvas");
  const ctx = canvas.getContext("2d");

  const title = $("#quoteTitle").value.trim() || "Crafting Quote";
  const forWho = $("#quoteFor").value.trim();
  const byWho = $("#quoteBy").value.trim();
  const date =
    $("#quoteDate").value.trim() || new Date().toISOString().slice(0, 10);
  const notes = $("#quoteNotes").value.trim();

  const colPos = PAD;
  const colDesc = PAD + 60;
  const colAmount = W - PAD; // right edge, line total
  const colPrice = colAmount - 130; // right edge, unit price
  const colQty = colPrice - 120; // right edge, quantity
  const descWidth = colQty - 60 - colDesc;

  /* ---- measure ---- */
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = '15px "Segoe UI", sans-serif';
  const rows = state.quote.map((r, i) => ({
    pos: i + 1,
    lines: wrapText(ctx, r.desc || "—", descWidth),
    qty: String(r.qty || 1),
    price: r.price === "" ? "—" : gil(r.price),
    amount: r.price === "" ? "—" : gil(rowAmount(r)),
  }));

  // market-board reference: what the requested items would cost bought outright
  const mbRows = state.roots.map((r) => {
    const c = costFor(r.tree.id, r.qty, rootMode(r));
    const quality = canBeHq(r.tree.id)
      ? rootMode(r) === "hq"
        ? " (HQ)"
        : " (NQ)"
      : "";
    return {
      label: `${r.qty}× ${r.tree.name}${quality}`,
      price: c && c.filled ? c.total : null,
      short: !!(c && c.short),
    };
  });
  const mbTotal = mbRows.reduce((s, r) => s + (r.price || 0), 0);
  const mbPartial = mbRows.some((r) => r.price === null || r.short);

  let h = PAD + 34; // title block
  if (forWho || byWho) h += 20;
  h += 30 + 30; // spacing + table header
  rows.forEach((r) => {
    h += r.lines.length * LINE_H + ROW_PAD;
  });
  h += 44; // total

  if (mbRows.length) {
    h += 34; // section heading
    h += mbRows.length * 20;
    h += 26; // mb total
    if (mbPartial) h += 16;
  }

  let notesLines = [];
  if (notes) {
    ctx.font = '13px "Segoe UI", sans-serif';
    notesLines = notes
      .split("\n")
      .flatMap((l) => wrapText(ctx, l, W - 2 * PAD));
    h += 20 + notesLines.length * 18;
  }
  h += 30 + PAD; // footer
  const H = Math.round(h);

  /* ---- draw ---- */
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  let y = PAD + 22;
  ctx.fillStyle = C.accent;
  ctx.font = '700 24px "Segoe UI", sans-serif';
  ctx.textAlign = "left";
  ctx.fillText(title, PAD, y);

  ctx.textAlign = "right";
  ctx.fillStyle = C.muted;
  ctx.font = '13px "Segoe UI", sans-serif';
  ctx.fillText(date, W - PAD, y);
  y += 12;

  if (forWho || byWho) {
    y += 20;
    ctx.textAlign = "left";
    ctx.font = '13px "Segoe UI", sans-serif';
    ctx.fillStyle = C.muted;
    ctx.fillText(
      [forWho && `For: ${forWho}`, byWho && `From: ${byWho}`]
        .filter(Boolean)
        .join("     "),
      PAD,
      y,
    );
  }
  y += 30;

  // table header
  ctx.fillStyle = C.head;
  ctx.fillRect(PAD - 10, y, W - 2 * PAD + 20, 30);
  ctx.fillStyle = C.muted;
  ctx.font = '600 13px "Segoe UI", sans-serif';
  ctx.textAlign = "left";
  ctx.fillText("POS", colPos, y + 20);
  ctx.fillText("DESCRIPTION", colDesc, y + 20);
  ctx.textAlign = "right";
  ctx.fillText("QTY", colQty, y + 20);
  ctx.fillText("UNIT PRICE", colPrice, y + 20);
  ctx.fillText("AMOUNT (GIL)", colAmount, y + 20);
  y += 30;

  // rows
  rows.forEach((r) => {
    ctx.fillStyle = C.text;
    ctx.font = '15px "Segoe UI", sans-serif';
    ctx.textAlign = "left";
    ctx.fillText(String(r.pos), colPos, y + LINE_H);
    r.lines.forEach((l, i) =>
      ctx.fillText(l, colDesc, y + LINE_H + i * LINE_H),
    );
    ctx.textAlign = "right";
    ctx.fillText(r.qty, colQty, y + LINE_H);
    ctx.fillText(r.price, colPrice, y + LINE_H);
    ctx.fillText(r.amount, colAmount, y + LINE_H);

    y += r.lines.length * LINE_H + ROW_PAD;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD - 10, y + 0.5);
    ctx.lineTo(W - PAD + 10, y + 0.5);
    ctx.stroke();
  });

  // total
  y += 30;
  ctx.fillStyle = C.text;
  ctx.font = '700 16px "Segoe UI", sans-serif';
  ctx.textAlign = "right";
  ctx.fillText("Total", colAmount - 150, y);
  ctx.fillText(gil(quoteTotal()) + " gil", colAmount, y);
  y += 14;

  /* market-board comparison — context for the customer, the quote should undercut it */
  if (mbRows.length) {
    y += 30;
    ctx.textAlign = "left";
    ctx.fillStyle = C.accent;
    ctx.font = '600 13px "Segoe UI", sans-serif';
    ctx.fillText(
      `FOR REFERENCE — CHEAPEST ON THE MARKET BOARD (${state.dc})`,
      PAD,
      y,
    );
    y += 18;

    ctx.font = '13px "Segoe UI", sans-serif';
    mbRows.forEach((r) => {
      ctx.textAlign = "left";
      ctx.fillStyle = C.muted;
      ctx.fillText(ellipsize(ctx, r.label, descWidth), PAD, y + 14);
      ctx.textAlign = "right";
      ctx.fillText(
        r.price === null
          ? "no listing"
          : gil(r.price) + " gil" + (r.short ? "*" : ""),
        colAmount,
        y + 14,
      );
      y += 20;
    });

    y += 8;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W - PAD - 260, y + 0.5);
    ctx.lineTo(W - PAD, y + 0.5);
    ctx.stroke();
    y += 18;

    ctx.fillStyle = C.text;
    ctx.font = '600 14px "Segoe UI", sans-serif';
    ctx.textAlign = "right";
    ctx.fillText("Market board total", colAmount - 150, y);
    ctx.fillText(gil(mbTotal) + " gil" + (mbPartial ? "*" : ""), colAmount, y);

    if (mbPartial) {
      y += 16;
      ctx.textAlign = "left";
      ctx.fillStyle = C.muted;
      ctx.font = '11px "Segoe UI", sans-serif';
      ctx.fillText(
        "* not enough listed on the datacenter to cover the full amount",
        PAD,
        y,
      );
    }
  }

  // notes
  if (notesLines.length) {
    y += 20;
    ctx.textAlign = "left";
    ctx.fillStyle = C.muted;
    ctx.font = '13px "Segoe UI", sans-serif';
    notesLines.forEach((l) => {
      ctx.fillText(l, PAD, y);
      y += 18;
    });
  }

  // footer
  ctx.textAlign = "left";
  ctx.fillStyle = C.muted;
  ctx.font = '11px "Segoe UI", sans-serif';
  ctx.fillText(
    "Generated with the FFXIV Crafting Quote Builder",
    PAD,
    H - PAD + 6,
  );

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      (title.replace(/[^\w\-]+/g, "_").toLowerCase() || "quote") + ".png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast("PNG exported.");
  }, "image/png");
}
