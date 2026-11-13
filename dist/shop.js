let catalog = [
  { id: 1, name: 'Sola Hoops', type: 'Earrings', price: 14500 },
  { id: 2, name: 'Pearl Drop Necklace', type: 'Necklaces', price: 18000 },
  { id: 3, name: 'Dune Cuff', type: 'Bracelets', price: 16500 },
  { id: 4, name: 'Lumi Dome Ring', type: 'Rings', price: 12500 },
  { id: 5, name: 'Fine Line Bracelet', type: 'Bracelets', price: 11500 },
  { id: 6, name: 'Chain, Cuff & Ring Set', type: 'Combos', price: 47000, members: [2, 3, 4] },
  { id: 7, name: 'Hoops & Fine Bracelet Set', type: 'Combos', price: 26000, members: [1, 5] }
];

const filters = document.querySelector('#filters');
const categoryTiles = document.querySelector('#category-tiles');
const search = document.querySelector('#search');
const searchForm = search.form;
const results = document.querySelector('#results');
const allJewelry = 'All jewelry';
const categorySamples = catalog.filter(item => item.type !== 'Combos').filter((item, index) =>
  catalog.findIndex(product => product.type === item.type) === index
);
let category = allJewelry;
const products = document.querySelector('#products');
const combos = document.querySelector('#combo-products');
const dialog = document.querySelector('#bag-dialog');
const items = document.querySelector('#bag-items');
const total = document.querySelector('#bag-total');
const bagCount = document.querySelector('#bag-count');
const status = document.querySelector('#status');
const samples = catalog;
const escape = value => String(value).replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const storageKey = 'glossygemz-bag';
const money = amount => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency: 'NGN', maximumFractionDigits: 0
}).format(amount);

const bag = Object.create(null);
const giftKey = 'glossygemz-gifts';
const giftForm = document.querySelector('#gift-form');
const giftOptions = document.querySelector('#gift-options');
const giftNote = document.querySelector('#gift-note');
const giftTotal = document.querySelector('#gift-total');
let gifts = [];
try {
  const saved = JSON.parse(localStorage.getItem(giftKey));
  if (Array.isArray(saved)) gifts = saved.filter(gift =>
    Array.isArray(gift?.pieces) && gift.pieces.length &&
    gift.pieces.every(id => typeof id === 'string') && typeof gift.note === 'string'
  );
} catch {
  // A new bag remains available when storage is unavailable.
}
let statusTimer;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  for (const id of Object.keys(saved || {})) {
    if (Number.isSafeInteger(saved?.[id]) && saved[id] > 0) {
      bag[id] = Math.min(99, saved[id]);
    }
  }
} catch {
  // The bag can still be used for this visit.
}

function renderProducts() {
  const terms = search.value.toLowerCase().trim().split(/\s+/);
  const shown = catalog.filter(item => {
    const searchable = `${item.name} ${item.type}`.toLowerCase();
    return item.type !== 'Combos' && (category === allJewelry || item.type === category) &&
      terms.every(term => searchable.includes(term));
  });
  products.innerHTML = productCards(shown) || '<p class="empty">No jewelry matches your search.</p>';
  combos.innerHTML = productCards(catalog.filter(item => item.type === 'Combos')) || '<p>No jewelry combos are available yet.</p>';
  results.textContent = shown.length + ' products shown.';
  for (const button of filters.children) button.setAttribute('aria-pressed', String(button.textContent === category));
}

function productCards(list) {
  return list.map(({ id, name, price, type, stock, photos, members }) => `
    <article class="product">
      ${members ? '<div class="combo-photos">' + members.map(id => '<div class="product-photo photo-' + id + '"></div>').join('') + '</div>' : `<div class="product-photo ${photos ? 'uploaded-photo' : 'photo-' + id}" ${photos ? '' : 'role="img" aria-label="' + escape(name) + '"'}>${photos ? '<img loading="lazy" src="/media/' + photos[0] + '" alt="' + escape(name) + '">' : ''}</div>`}
      ${photos?.length > 1 ? '<details class="extra-photos"><summary>More photos</summary>' + photos.slice(1).map(photo => '<a href="/media/' + photo + '" target="_blank" rel="noopener"><img loading="lazy" src="/media/' + photo + '" alt="More views of ' + escape(name) + '"></a>').join('') + '</details>' : ''}
      <div class="product-info">
        <p class="product-type">${type}</p>
        <h3>${escape(name)}</h3>
        <div class="product-actions">
          <p>${money(price)}</p>
          <button type="button" data-add="${id}" ${stock === 0 ? 'disabled' : ''} aria-label="Add ${escape(name)} to bag">${stock === 0 ? 'Sold out' : 'Add to bag'}</button>
        </div>
      </div>
    </article>`).join('');

}

function productFor(id) {
  return catalog.find(product => String(product.id) === String(id));
}

function giftQuantity(id) {
  return gifts.reduce((count, gift) => count + Number(gift.pieces.includes(String(id))), 0);
}

function available(id) {
  return Math.max(0, Math.min(99, productFor(id)?.stock ?? 99) - giftQuantity(id));
}

function selectedGiftProducts() {
  return [...giftOptions.querySelectorAll('input:checked')].map(input => productFor(input.value)).filter(Boolean);
}

function updateGiftTotal() {
  const selected = selectedGiftProducts();
  giftTotal.textContent = 'Gift subtotal ' + money(selected.reduce((sum, item) => sum + item.price, 0));
  giftForm.querySelector('button').disabled = selected.length === 0;
}

function renderGiftOptions() {
  const checked = new Set(selectedGiftProducts().map(item => String(item.id)));
  giftOptions.innerHTML = catalog.filter(({ stock, type }) => stock !== 0 && type !== 'Combos').map(({ id, name, price }) => {
    const canAdd = available(id) > (bag[id] || 0);
    return `<label class="gift-option"><input type="checkbox" value="${id}" ${canAdd && checked.has(String(id)) ? 'checked' : ''} ${canAdd ? '' : 'disabled'}><span>${escape(name)}<small>${canAdd ? '' : 'Already at available quantity'}</small></span><span>${money(price)}</span></label>`;
  }).join('') || '<p>No pieces are available for gifting right now.</p>';
  updateGiftTotal();
}

function saveGifts() {
  try { localStorage.setItem(giftKey, JSON.stringify(gifts)); } catch {
    // Keep packages in memory when browser storage is unavailable.
  }
}

function announce(message) {
  status.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { status.textContent = ''; }, 2400);
}

function renderBag() {
  const selected = catalog.filter(({ id }) => bag[id]);
  const packages = gifts.map(gift => {
    const pieces = gift.pieces.map(productFor);
    const valid = pieces.every((piece, index) => piece &&
      (piece.stock ?? 99) >= giftQuantity(gift.pieces[index]) + (bag[piece.id] || 0));
    return { ...gift, pieces, valid, price: valid ? pieces.reduce((sum, piece) => sum + piece.price, 0) : 0 };
  });
  bagCount.textContent = selected.reduce((sum, { id }) => sum + bag[id], gifts.length);
  items.innerHTML = selected.map(({ id, name, price }) => `
    <div class="bag-item">
      <div><strong>${escape(name)}</strong><p>${money(price)}</p></div>
      <div class="quantity">
        <button type="button" data-id="${id}" data-change="-1" aria-label="Remove one ${escape(name)}">−</button>
        <span>${bag[id]}</span>
        <button type="button" data-id="${id}" data-change="1" aria-label="Add one ${escape(name)}">+</button>
      </div>
    </div>`).join('');
  items.innerHTML += packages.map(({ pieces, note, price, valid }, index) => `
    <div class="bag-item">
      <div><strong>Gift package</strong>
        <p>${pieces.map(piece => piece ? escape(piece.name) : 'Unavailable item').join(', ')}</p>
        ${note ? '<p class="gift-note">' + escape(note) + '</p>' : ''}
        <p>${valid ? money(price) : 'Some items in this package are unavailable.'}</p>
      </div>
      <button type="button" data-remove-gift="${index}">Remove<span class="sr-only"> gift package</span></button>
    </div>`).join('');
  if (!selected.length && !packages.length) items.innerHTML = '<p>Your bag is empty.</p>';
  total.innerHTML = selected.length || packages.some(gift => gift.valid)
    ? `<strong>Subtotal</strong><strong>${money(selected.reduce((sum, { id, price }) => sum + bag[id] * price, packages.reduce((sum, gift) => sum + gift.price, 0)))}</strong>`
    : '';
}

function changeQuantity(id, change) {
  bag[id] = Math.max(0, Math.min(available(id), (bag[id] || 0) + change));
  try {
    localStorage.setItem(storageKey, JSON.stringify(bag));
  } catch {
    // Keep the current bag in memory when browser storage is unavailable.
  }
  renderBag();
}

categoryTiles.innerHTML = categorySamples.map(({ id, type }) => `
  <a class="category-tile" href="#collection" data-category="${type}">
    <div class="category-photo photo-${id}" aria-hidden="true"></div>
    <span class="tile-label">${type}<span aria-hidden="true">↗</span></span>
  </a>`).join('');
filters.innerHTML = [allJewelry, ...categorySamples.map(({ type }) => type)]
  .map(type => `<button type="button">${type}</button>`).join('');
filters.addEventListener('click', event => {
  if (!event.target.matches('button')) return;
  category = event.target.textContent;
  renderProducts();
});
document.querySelector('main').addEventListener('click', event => {
  const link = event.target.closest('a[href="#collection"]');
  if (!link) return;
  category = link.dataset.category || allJewelry;
  search.value = '';
  renderProducts();
});
document.querySelector('.nav').addEventListener('click', event => {
  if (!event.target.closest('a[href="#collection"]')) return;
  category = allJewelry;
  search.value = '';
  renderProducts();
});
search.addEventListener('input', () => {
  category = allJewelry;
  renderProducts();
});
searchForm.addEventListener('submit', event => {
  event.preventDefault();
  category = allJewelry;
  renderProducts();
  window.location.hash = 'collection';
});
document.querySelector('main').addEventListener('click', event => {
  const id = event.target.dataset.add;
  if (!id) return;
  const product = catalog.find(item => String(item.id) === id);
  if (!product || product.stock === 0) return;
  const atLimit = (bag[id] || 0) >= available(id);
  changeQuantity(id, 1);
  status.textContent = atLimit ? 'Maximum quantity reached.' : `${product.name} added to your bag.`;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { status.textContent = ''; }, 2400);
});
giftOptions.addEventListener('change', updateGiftTotal);
giftForm.addEventListener('submit', event => {
  event.preventDefault();
  const pieces = selectedGiftProducts().map(({ id }) => String(id));
  if (!pieces.length || pieces.some(id => available(id) <= (bag[id] || 0))) return;
  gifts.push({ pieces, note: giftNote.value.trim().slice(0, 200) });
  saveGifts();
  giftForm.reset();
  renderGiftOptions();
  renderBag();
  announce('Gift package added to your bag.');
});

items.addEventListener('click', event => {
  const removeGift = event.target.closest('[data-remove-gift]');
  if (removeGift) {
    const index = Number(removeGift.dataset.removeGift);
    gifts.splice(index, 1);
    saveGifts();
    renderBag();
    renderGiftOptions();
    (items.querySelector('[data-remove-gift="' + index + '"]') || document.querySelector('#close-bag')).focus();
    return;
  }
  const { id, change } = event.target.dataset;
  if (!id) return;
  changeQuantity(id, Number(change));
  const nextControl = items.querySelector(`[data-id="${id}"][data-change="${change}"]`);
  (nextControl || document.querySelector('#close-bag')).focus();
});
document.querySelector('#open-bag').addEventListener('click', () => dialog.showModal());
document.querySelector('#close-bag').addEventListener('click', () => dialog.close());
renderProducts();
renderBag();
renderGiftOptions();
loadCatalog();

if ('IntersectionObserver' in window && window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.dataset.reveal = 'visible';
      observer.unobserve(entry.target);
    }
  });

  for (const element of document.querySelectorAll('.category-tile, .edit-photo, .edit-copy')) {
    if (element.getBoundingClientRect().top < window.innerHeight) continue;
    element.dataset.reveal = 'pending';
    observer.observe(element);
  }
}

async function loadCatalog() {
  try {
    const response = await fetch('/api/catalog');
    if (!response.ok) throw new Error('Catalog unavailable');
    const products = await response.json();
    if (!products.length) return;
    catalog = products;
    document.querySelector('#catalog-note').hidden = true;
    for (const { id, stock } of catalog) {
      if (bag[id]) bag[id] = Math.min(bag[id], stock);
    }
  } catch {
    catalog = samples;
    document.querySelector('#catalog-note').textContent = 'Live catalog temporarily unavailable. Showing samples.';
  }
  renderProducts();
  renderBag();
  renderGiftOptions();
}
