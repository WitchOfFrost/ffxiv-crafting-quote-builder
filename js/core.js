/* Shared state + small helpers.
   Classic script (no ES modules) so index.html also works from file://. */

const XIVAPI = 'https://v2.xivapi.com/api';
const UNIVERSALIS = 'https://universalis.app/api/v2';
const MAX_DEPTH = 5;        // how deep precrafts get expanded
const PRICE_CHUNK = 100;    // Universalis accepts 100 item ids per request

const state = {
  dc: localStorage.getItem('cqb.dc') || 'Chaos',
  roots: [],                 // [{uid, item, qty, tree}]  — the craft list
  prices: new Map(),         // itemId -> {price, world, hq} | null
  quote: [],                 // [{desc, price}]            — the quote table
};

const $ = sel => document.querySelector(sel);
const gil = n => Number(n || 0).toLocaleString('en-US');
const uid = () => Math.random().toString(36).slice(2, 10);

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function iconUrl(icon) {
  if (!icon || !icon.path) return '';
  return `${XIVAPI}/asset?path=${encodeURIComponent(icon.path)}&format=png`;
}

function toast(msg, ms = 2800) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}
