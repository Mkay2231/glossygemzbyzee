let catalog = [
  { id: 1, name: 'Sola Hoops', type: 'Earrings', price: 14500 },
  { id: 2, name: 'Pearl Drop Necklace', type: 'Necklaces', price: 18000 },
  { id: 3, name: 'Dune Cuff', type: 'Bracelets', price: 16500 },
  { id: 4, name: 'Lumi Dome Ring', type: 'Rings', price: 12500 },
  { id: 5, name: 'Fine Line Bracelet', type: 'Bracelets', price: 11500 }
];

const filters = document.querySelector('#filters');
const categoryTiles = document.querySelector('#category-tiles');
const search = document.querySelector('#search');
const searchForm = search.form;
const results = document.querySelector('#results');
const allJewelry = 'All jewelry';
const categorySamples = catalog.filter((item, index) =>
  catalog.findIndex(product => product.type === item.type) === index
);
let category = allJewelry;
const products = document.querySelector('#products');
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

const bag = {};
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
    return (category === allJewelry || item.type === category) &&
      terms.every(term => searchable.includes(term));
  });
  products.innerHTML = shown.map(({ id, name, price, type, stock, photos }) => `
    <article class="product">
      <div class="product-photo ${photos ? 'uploaded-photo' : 'photo-' + id}" ${photos ? '' : 'role="img" aria-label="' + escape(name) + '"'}>${photos ? '<img loading="lazy" src="/media/' + photos[0] + '" alt="' + escape(name) + '">' : ''}</div>
      ${photos?.length > 1 ? '<details class="extra-photos"><summary>More photos</summary>' + photos.slice(1).map(photo => '<a href="/media/' + photo + '" target="_blank" rel="noopener"><img loading="lazy" src="/media/' + photo + '" alt="More views of ' + escape(name) + '"></a>').join('') + '</details>' : ''}
      <div class="product-info">
        <p class="product-type">${type}</p>
        <h3>${escape(name)}</h3>
        <div class="product-actions">
          <p>${money(price)}</p>
          <button type="button" data-add="${id}" ${stock === 0 ? 'disabled' : ''} aria-label="Add ${escape(name)} to bag">${stock === 0 ? 'Sold out' : 'Add to bag'}</button>
        </div>
      </div>
    </article>`).join('') || '<p class="empty">No jewelry matches your search.</p>';
  results.textContent = `${shown.length} ${shown.length === 1 ? 'product' : 'products'} shown.`;
  for (const button of filters.children) {
    button.setAttribute('aria-pressed', String(button.textContent === category));
  }
}

function renderBag() {
  const selected = catalog.filter(({ id }) => bag[id]);
  bagCount.textContent = selected.reduce((sum, { id }) => sum + bag[id], 0);
  items.innerHTML = selected.map(({ id, name, price }) => `
    <div class="bag-item">
      <div><strong>${escape(name)}</strong><p>${money(price)}</p></div>
      <div class="quantity">
        <button type="button" data-id="${id}" data-change="-1" aria-label="Remove one ${escape(name)}">−</button>
        <span>${bag[id]}</span>
        <button type="button" data-id="${id}" data-change="1" aria-label="Add one ${escape(name)}">+</button>
      </div>
    </div>`).join('') || '<p>Your bag is empty.</p>';
  total.innerHTML = selected.length
    ? `<strong>Subtotal</strong><strong>${money(selected.reduce((sum, { id, price }) => sum + bag[id] * price, 0))}</strong>`
    : '';
}

function changeQuantity(id, change) {
  bag[id] = Math.max(0, Math.min(catalog.find(item => String(item.id) === String(id))?.stock ?? 99, 99, (bag[id] || 0) + change));
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
products.addEventListener('click', event => {
  const id = event.target.dataset.add;
  if (!id) return;
  const product = catalog.find(item => String(item.id) === id);
  if (!product || product.stock === 0) return;
  const atLimit = (bag[id] || 0) >= Math.min(99, product.stock ?? 99);
  changeQuantity(id, 1);
  status.textContent = atLimit ? 'Maximum quantity reached.' : `${product.name} added to your bag.`;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { status.textContent = ''; }, 2400);
});
items.addEventListener('click', event => {
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
}
