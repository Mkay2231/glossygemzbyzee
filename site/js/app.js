(() => {
  'use strict';

  const GG = window.GG;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const page = document.body.dataset.page;
  const params = new URLSearchParams(location.search);

  const esc = value => String(value).replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const money = amount => '₦' + Math.round(amount).toLocaleString('en-NG');

  /* ---------- icons: one stroke weight, drawn here ---------- */
  const paths = {
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.500 15.400 12 20 12 20Z"/>',
    bag: '<path d="M5.500 8.500h13l1 11.500h-15l1-11.500Z"/><path d="M9 8.500V7a3 3 0 0 1 6 0v1.500"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    truck: '<path d="M2.500 6.500h11.500v10H2.500zM14 10h4l3.500 3.500v3H14z"/><circle cx="7" cy="17.500" r="1.800"/><circle cx="17.500" cy="17.500" r="1.800"/>',
    chat: '<path d="M4 5h16v11.500H10L5.500 20v-3.500H4V5Z"/><path d="M8 9.500h8M8 12.500h5"/>',
    gift: '<path d="M4.500 11h15v9h-15zM3.500 7.500h17V11h-17zM12 7.500V20"/><path d="M12 7.500c-1.200-3.200-5-3.400-5-1.300 0 1.600 3 1.300 5 1.300Zm0 0c1.200-3.200 5-3.400 5-1.300 0 1.600-3 1.300-5 1.300Z"/>',
    tag: '<path d="M3.500 12.500V4h8.500l8.500 8.500-8 8-9-8Z"/><circle cx="8" cy="8.500" r="1.300"/>',
    check: '<path d="m5 12.500 4.500 4.500L19 7.500"/>',
    copy: '<path d="M8.500 8.500h10v11h-10z"/><path d="M5.500 15.500v-11h10"/>',
    play: '<path d="M8 5.500v13l10.500-6.500L8 5.500Z"/>'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;

  /* ---------- storage ---------- */
  const read = (key, fallback, area = localStorage) => {
    try { return JSON.parse(area.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const write = (key, value, area = localStorage) => {
    try { area.setItem(key, JSON.stringify(value)); } catch { /* still works for this visit */ }
  };

  let bag = {};
  const savedBag = read('ggz-bag', {});
  if (savedBag && typeof savedBag === 'object') {
    for (const [key, qty] of Object.entries(savedBag)) {
      if (Number.isSafeInteger(qty) && qty > 0) bag[key] = Math.min(99, qty);
    }
  }
  let gifts = read('ggz-gifts', []);
  gifts = Array.isArray(gifts) ? gifts.filter(gift =>
    Array.isArray(gift?.pieces) && gift.pieces.length &&
    gift.pieces.every(key => typeof key === 'string') && typeof gift.note === 'string') : [];
  let saved = read('ggz-saved', []);
  saved = Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : [];

  /* ---------- live store data ---------- */
  function apply(data) {
    GG.everything = data.products.map(product => ({
      ...product,
      members: product.members?.length ? product.members : null,
      sizes: product.sizes || [],
      photos: product.photos || [],
      cashMin: product.cashMin ?? null
    }));
    /* Gift items (flowers, money bouquets...) are sold only in the Gift Builder, never in the shop. */
    GG.catalog = GG.everything.filter(product => product.type !== GG.giftType);
    GG.giftItems = GG.everything.filter(product => product.type === GG.giftType);
    GG.sale = data.sale;
    GG.delivery = data.delivery || GG.delivery;
    GG.contact = { ...GG.contact, ...data.contact };
    GG.policies = data.policies || GG.policies;
    GG.sample = Boolean(data.sample);
    GG.loaded = true;
  }

  /* After a fresh load, drop anything in the bag that is no longer sold and cap quantities at stock. */
  function tidyBag() {
    for (const key of Object.keys(bag)) {
      const product = byId(split(key).id);
      if (!product || product.stock === 0) delete bag[key];
      else bag[key] = Math.min(bag[key], stockOf(product));
    }
    gifts = gifts.filter(gift => gift.pieces.every(key => { const product = byId(split(key).id); return product && product.stock > 0; }));
    write('ggz-bag', bag);
    write('ggz-gifts', gifts);
    const waiting = read('ggz-notify', []);
    if (Array.isArray(waiting) && waiting.length) write('ggz-notify', waiting.filter(id => byId(id)?.stock === 0));
  }

  /* ---------- catalogue helpers ---------- */
  const byId = id => (GG.everything || GG.catalog).find(product => String(product.id) === String(id));
  /* Bag and gift keys: "id", "id::size", or "id::size::cash" for a money bouquet. */
  const split = key => { const [id, size = '', cash = ''] = String(key).split('::'); return { id, size, cash: Math.max(0, Math.round(Number(cash) || 0)) }; };
  const optionText = size => /^\d+(\.\d+)?$/.test(size) ? 'size ' + size : size;
  const pieceText = (name, size, cash) => name + (size ? ' (' + optionText(size) + ')' : '') + (cash ? ' (' + money(cash) + ' cash)' : '');
  const photoUrl = photo => /^[a-f0-9-]{36}$/.test(photo) ? '/media/' + photo : '/' + String(photo).replace(/^\//, '');
  const src = product => photoUrl(product.photos[0] || 'assets/img/logo-badge.jpg');
  const link = product => '/product.html?id=' + encodeURIComponent(product.id);
  /* Available pieces first, sold-out ones at the end, otherwise keeping the order given. */
  const availableFirst = list => [...list].sort((a, b) => (a.stock === 0) - (b.stock === 0));
  const pieces = () => availableFirst(GG.catalog.filter(product => !product.members));
  const stockOf = product => Math.max(0, Math.min(99, product.stock ?? 99));
  const waDisplay = () => GG.contact.whatsapp.replace(/^234(\d{3})(\d{3})(\d{4})$/, '0$1 $2 $3');

  function saleState(now = Date.now()) {
    const sale = GG.sale;
    if (!sale || !sale.enabled || !sale.percent) return 'over';
    if (now < Date.parse(sale.start)) return 'upcoming';
    return now <= Date.parse(sale.end) ? 'active' : 'over';
  }
  const off = amount => Math.round(amount * (100 - GG.sale.percent) / 100);
  const dayParts = iso => {
    const parts = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' }).formatToParts(new Date(iso));
    return { day: parts.find(part => part.type === 'day').value, month: parts.find(part => part.type === 'month').value };
  };
  const saleStart = () => { const d = dayParts(GG.sale.start); return `${d.day} ${d.month}`; };
  const saleEnd = () => { const d = dayParts(GG.sale.end); return `${d.day} ${d.month}`; };
  const saleDates = () => {
    const a = dayParts(GG.sale.start);
    const b = dayParts(GG.sale.end);
    return a.month === b.month ? `${a.day} to ${b.day} ${b.month}` : `${a.day} ${a.month} to ${b.day} ${b.month}`;
  };

  function priceHTML(product) {
    if (saleState() !== 'active') return `<span class="price">${money(product.price)}</span>`;
    return `<span class="price price--sale"><s><span class="sr-only">Was </span>${money(product.price)}</s> <span class="sr-only">Now </span>${money(off(product.price))}</span>`;
  }

  /* On computers, pointing at a card shows the product's second photo. Phones can't hover,
     so they never download it. */
  const canHover = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  const altPhoto = product => canHover && product.photos.length > 1
    ? `<img class="card__alt" src="${esc(photoUrl(product.photos[1]))}" alt="" width="512" height="512" loading="lazy">` : '';

  function media(product, eager) {
    const loading = eager ? '' : ' loading="lazy"';
    if (!product.members) {
      return `<img src="${esc(src(product))}" alt="${esc(product.name)}" width="512" height="512"${loading}>${altPhoto(product)}`;
    }
    const members = product.members.map(byId).filter(Boolean);
    if (product.photos.length || !members.length) {
      return `<img src="${esc(src(product))}" alt="${esc(product.name)}" width="512" height="512"${loading}>${altPhoto(product)}`;
    }
    const shown = members.slice(0, 3);
    return `<span class="cluster cluster--${shown.length}" role="img" aria-label="${esc(product.name)}: ${esc(members.map(m => m.name).join(', '))}">${
      shown.map(member => `<span class="ring"><img src="${esc(src(member))}" alt="" width="512" height="512"${loading}></span>`).join('')}</span>`;
  }
  const isCluster = product => Boolean(product.members && !product.photos.length && product.members.some(byId));

  function card(product, feature) {
    const name = esc(product.name);
    const soldOut = product.stock === 0;
    const needsSize = Boolean(product.sizes.length);
    const add = soldOut
      ? '<span class="soldout">Sold out</span>'
      : needsSize
        ? `<a class="add" href="${link(product)}" aria-label="Choose a size for ${name}">${icon('arrow')}</a>`
        : `<button class="add" type="button" data-add="${esc(product.id)}" aria-label="Add ${name} to bag">${icon('plus')}</button>`;
    return `<article class="card${feature ? ' card--feature' : ''}${soldOut ? ' is-soldout' : ''}">
      <a class="card__media${isCluster(product) ? ' card__media--set' : ''}" href="${link(product)}" tabindex="-1" aria-hidden="true">${media(product, feature)}${product.video ? `<span class="card__tag">${icon('play')} Video</span>` : ''}</a>
      <button class="save" type="button" data-save="${esc(product.id)}" aria-pressed="${saved.includes(String(product.id))}" aria-label="Save ${name}">${icon('heart')}</button>
      <div class="card__body">
        <h3 class="card__name"><a href="${link(product)}">${name}</a></h3>
        <p class="card__type">${esc(product.type)}${product.members ? ' · ' + product.members.length + ' pieces' : ''}</p>
        <div class="card__foot">${priceHTML(product)}${add}</div>
      </div>
    </article>`;
  }

  const skeleton = count => Array.from({ length: count }, () =>
    '<div class="card card--ghost" aria-hidden="true"><div class="card__media"></div><div class="card__body"><p></p><p></p></div></div>').join('');

  /* While the catalogue is on its way, or if it could not be reached. Returns true when the page should wait. */
  function waiting(root, ghosts = 0) {
    if (GG.loaded) return false;
    root.innerHTML = GG.failed
      ? `<div class="empty"><p class="empty__title">We couldn't load the collection.</p><p>Check your connection and try again, or message Zee on WhatsApp.</p>
          <div class="done__actions"><button class="btn btn--primary" type="button" data-reload>Try again</button><a class="btn btn--ghost" href="${wa('Hello Zee, I would like to see the collection.')}" target="_blank" rel="noopener">${icon('chat')} WhatsApp Zee</a></div></div>`
      : ghosts ? skeleton(ghosts) : '<p class="loading" role="status">Loading…</p>';
    return true;
  }

  /* ---------- bag maths ---------- */
  const giftPrice = gift => gift.pieces.reduce((sum, key) => { const { id, cash } = split(key); return sum + (byId(id)?.price || 0) + cash; }, 0);

  function totals() {
    let subtotal = 0;
    let count = 0;
    for (const [key, qty] of Object.entries(bag)) {
      const product = byId(split(key).id);
      if (!product) continue;
      subtotal += product.price * qty;
      count += qty;
    }
    for (const gift of gifts) { subtotal += giftPrice(gift); count += 1; }
    /* Money-bouquet cash is passed on as it is: the sale discount and the free gift threshold leave it out. */
    const cash = Object.entries(bag).reduce((sum, [key, qty]) => sum + split(key).cash * qty, 0) +
      gifts.reduce((sum, gift) => sum + gift.pieces.reduce((inner, key) => inner + split(key).cash, 0), 0);
    const active = saleState() === 'active';
    const discountable = subtotal - cash;
    const discount = active ? discountable - off(discountable) : 0;
    const total = subtotal - discount;
    return { subtotal, discount, total, count, active, cash, freeGift: active && discountable - discount > GG.sale.giftOver };
  }

  function orderText(intro) {
    const lines = [intro || `Hello Zee, I'd like to order from ${GG.brand.name}:`, ''];
    for (const [key, qty] of Object.entries(bag)) {
      const { id, size } = split(key);
      const product = byId(id);
      if (product) lines.push(`• ${qty} x ${product.name}${size ? ' (size ' + size + ')' : ''}: ${money(product.price * qty)}`);
    }
    for (const gift of gifts) {
      const names = gift.pieces.map(key => {
        const { id, size, cash } = split(key);
        const product = byId(id);
        return product && pieceText(product.name, size, cash);
      }).filter(Boolean);
      lines.push(`• Gift: ${names.join(', ')}: ${money(giftPrice(gift))}`);
      if (gift.note) lines.push(`  Note: "${gift.note}"`);
    }
    const sum = totals();
    if (sum.discount) lines.push('', `${GG.sale.name} (${GG.sale.percent}% off${sum.cash ? ', bouquet cash not included' : ''}): -${money(sum.discount)}`);
    lines.push('', `Total before delivery: ${money(sum.total)}`);
    return lines.join('\n');
  }
  const wa = text => `https://wa.me/${GG.contact.whatsapp}?text=${encodeURIComponent(text)}`;

  /* ---------- shared chrome ---------- */
  function navLinks() {
    const type = params.get('type');
    return [
      ['/shop.html', 'Shop all', page === 'shop' && !type && !params.get('saved')],
      ...GG.types.filter(name => !GG.loaded || GG.catalog.some(product => product.type === name))
        .map(name => ['/shop.html?type=' + encodeURIComponent(name), name, page === 'shop' && type === name]),
      ['/gift.html', 'Gift Builder', page === 'gift'],
      ['/blog.html', 'Blog', page === 'blog' || page === 'post']
    ];
  }

  const navHTML = () => navLinks().map(([href, label, current]) => `<a href="${href}"${current ? ' aria-current="page"' : ''}>${label}</a>`).join('');

  function chrome() {
    const header = document.createElement('div');
    header.innerHTML = `
      <a class="skip" href="#main">Skip to content</a>
      <aside class="salebar-wrap" aria-label="Current sale"><a class="salebar" href="/shop.html" hidden></a></aside>
      <header class="site-header">
        <div class="wrap bar">
          <button class="icon-btn menu-btn" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Menu">${icon('menu')}</button>
          <a class="brand" href="/" aria-label="${esc(GG.brand.name)}, home">
            <img src="/assets/img/logo-badge.jpg" width="46" height="46" alt="">
            <span class="brand__name">${esc(GG.brand.short)}<small>by Zee</small></span>
          </a>
          <nav id="site-nav" class="nav" aria-label="Main">
            ${navHTML()}
          </nav>
          <div class="tools">
            <form class="search" role="search" action="/shop.html">
              <input name="q" type="search" placeholder="Search jewelry" aria-label="Search jewelry" value="${esc(page === 'shop' ? params.get('q') || '' : '')}">
              <button type="submit" aria-label="Search">${icon('search')}</button>
            </form>
            <a class="icon-btn" href="/shop.html?saved=1" aria-label="Saved pieces">${icon('heart')}<span class="count" data-saved-count hidden></span></a>
            <button class="icon-btn" type="button" data-open-bag aria-label="Open bag">${icon('bag')}<span class="count" data-bag-count hidden></span></button>
          </div>
        </div>
      </header>`;
    document.body.prepend(...header.childNodes);

    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    document.body.append(footer);
    document.body.id = 'top';
    drawFooter();

    const drawer = document.createElement('dialog');
    drawer.className = 'drawer';
    drawer.id = 'bag';
    drawer.setAttribute('aria-labelledby', 'bag-title');
    drawer.innerHTML = `
      <div class="drawer__head"><h2 id="bag-title">Your bag</h2><button class="icon-btn" type="button" data-close-bag aria-label="Close bag">${icon('close')}</button></div>
      <div class="drawer__body" data-bag-lines></div>
      <div class="drawer__foot" data-bag-foot></div>`;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.append(drawer, toast);

    drawer.addEventListener('click', event => { if (event.target === drawer) drawer.close(); });
    $('.menu-btn').addEventListener('click', event => {
      const open = document.body.classList.toggle('nav-open');
      event.currentTarget.setAttribute('aria-expanded', String(open));
    });
    saleBar();
    setInterval(saleBar, 30000);
  }

  function drawFooter() {
    $('.site-footer').innerHTML = `
      <div class="wrap footer-grid">
        <div class="footer-brand">
          <img src="/assets/img/logo-badge.jpg" width="150" height="150" alt="${esc(GG.brand.name)} logo" loading="lazy">
          <p>${esc(GG.brand.tagline)}.</p>
        </div>
        <div>
          <h2>Shop</h2>
          <ul>${navLinks().map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join('')}</ul>
        </div>
        <div>
          <h2>Talk to Zee</h2>
          <ul>
            <li><a href="${wa('Hello Zee, I have a question about ' + GG.brand.name + '.')}" target="_blank" rel="noopener">WhatsApp ${waDisplay()}</a></li>
            <li><a href="mailto:${GG.business.email}">${GG.business.email}</a></li>
            ${GG.contact.tiktok ? `<li><a href="https://www.tiktok.com/@${esc(GG.contact.tiktok)}" target="_blank" rel="noopener">TikTok @${esc(GG.contact.tiktok)}</a></li>` : ''}
            ${GG.contact.snapchat ? `<li><a href="https://www.snapchat.com/add/${esc(GG.contact.snapchat)}" target="_blank" rel="noopener">Snapchat ${esc(GG.contact.snapchat)}</a></li>` : ''}
          </ul>
        </div>
        <div>
          <h2>Good to know</h2>
          <ul>
            <li><a href="/order.html">Track your order</a></li>
            <li><a href="/help.html">Delivery, payment and returns</a></li>
            <li><a href="/help.html#sizes">Ring size guide</a></li>
            <li>We deliver nationwide</li>
            ${GG.sample ? '<li>Sample products and prices shown</li>' : ''}
          </ul>
        </div>
      </div>
      <div class="wrap footer-base">
        <nav class="footer-legal" aria-label="Legal"><a href="/privacy.html">Privacy policy</a><a href="/terms.html">Terms of service</a><a href="/refunds.html">Refund policy</a><a href="/cookies.html">Cookie policy</a></nav>
        <a href="#top">Back to top</a>
        <p class="footer-biz">© ${new Date().getFullYear()} ${esc(GG.business.legalName)} · CAC registration no. ${esc(GG.business.cac)} · ${esc(GG.business.place)}</p>
      </div>`;
  }

  function countdown(target) {
    const minutes = Math.max(0, Math.floor((target - Date.now()) / 60000));
    const d = Math.floor(minutes / 1440);
    const h = Math.floor(minutes % 1440 / 60);
    const m = minutes % 60;
    return (d ? d + 'd ' : '') + h + 'h ' + String(m).padStart(2, '0') + 'm';
  }

  function saleBar() {
    const bar = $('.salebar');
    const state = saleState();
    bar.hidden = state === 'over';
    bar.classList.toggle('is-live', state === 'active');
    if (state === 'over') return;
    const sale = GG.sale;
    const gift = sale.giftOver ? `Free gift over ${money(sale.giftOver)} · ` : '';
    bar.innerHTML = state === 'upcoming'
      ? `<span><strong>${esc(sale.name)}</strong> ${sale.percent}% off all orders</span><span class="salebar__time">${saleDates()} · starts in <b>${countdown(Date.parse(sale.start))}</b></span>`
      : `<span><strong>${esc(sale.name)}</strong> ${sale.percent}% off all orders</span><span class="salebar__time">${gift}ends in <b>${countdown(Date.parse(sale.end))}</b></span>`;
  }

  let toastTimer;
  function say(message) {
    const toast = $('.toast');
    toast.textContent = message;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2600);
  }

  /* ---------- bag rendering ---------- */
  function linesHTML() {
    const rows = Object.entries(bag).map(([key, qty]) => {
      const { id, size } = split(key);
      const product = byId(id);
      if (!product) return '';
      const name = esc(product.name);
      const members = product.members ? product.members.map(byId).filter(Boolean) : [];
      const meta = [size && esc(optionText(size).replace(/^s/, 'S')), members.length && members.map(m => esc(m.name)).join(', ')].filter(Boolean).join(' · ');
      const thumb = product.photos.length ? product : members[0] || product;
      return `<li class="line">
        <a class="line__thumb" href="${link(product)}" tabindex="-1" aria-hidden="true"><img src="${esc(src(thumb))}" alt="" width="72" height="72"></a>
        <div class="line__main">
          <a class="line__name" href="${link(product)}">${name}</a>
          ${meta ? `<p class="line__meta">${meta}</p>` : ''}
          <div class="line__row">
            <div class="qty" role="group" aria-label="Quantity of ${name}">
              <button type="button" data-qty="-1" data-key="${esc(key)}" aria-label="Remove one ${name}">${icon('minus')}</button>
              <span>${qty}</span>
              <button type="button" data-qty="1" data-key="${esc(key)}" aria-label="Add one ${name}"${qty >= stockOf(product) ? ' disabled' : ''}>${icon('plus')}</button>
            </div>
            <button class="textlink" type="button" data-remove="${esc(key)}">Remove<span class="sr-only"> ${name}</span></button>
          </div>
        </div>
        <p class="line__price">${money(product.price * qty)}</p>
      </li>`;
    });
    const packages = gifts.map((gift, index) => {
      const items = gift.pieces.map(key => ({ ...split(key), product: byId(split(key).id) })).filter(item => item.product);
      if (!items.length) return '';
      return `<li class="line line--gift">
        <span class="line__thumb line__thumb--gift">${icon('gift')}</span>
        <div class="line__main">
          <p class="line__name">Gift package</p>
          <p class="line__meta">${items.map(item => esc(pieceText(item.product.name, item.size, item.cash))).join(', ')}</p>
          ${gift.note ? `<p class="line__note">“${esc(gift.note)}”</p>` : ''}
          <div class="line__row"><button class="textlink" type="button" data-remove-gift="${index}">Remove<span class="sr-only"> gift package</span></button></div>
        </div>
        <p class="line__price">${money(giftPrice(gift))}</p>
      </li>`;
    });
    return rows.join('') + packages.join('');
  }

  /* `state` is the delivery state once the shopper has chosen one at checkout. */
  function sumHTML(state) {
    const sum = totals();
    const sale = GG.sale;
    const fee = state ? (state === 'Lagos' ? GG.delivery.lagos : GG.delivery.other) : undefined;
    const delivery = state === undefined ? 'Added at checkout'
      : !state ? 'Choose a state'
      : fee === null ? 'Zee will confirm'
      : fee === 0 ? 'Free' : money(fee);
    let note = '';
    if (sum.active && sale.giftOver) {
      note = sum.freeGift
        ? `<p class="perk perk--on">${icon('gift')} A free gift comes with this order.</p>`
        : `<p class="perk">${icon('gift')} Spend ${money(sale.giftOver - sum.total + 1)} more for a free gift.</p>`;
    } else if (saleState() === 'upcoming') {
      note = `<p class="perk">${icon('tag')} From ${saleStart()}: ${sale.percent}% off${sale.giftOver ? ' and a free gift over ' + money(sale.giftOver) : ''}.</p>`;
    }
    return `<dl class="sum">
        <div><dt>Subtotal</dt><dd>${money(sum.subtotal)}</dd></div>
        ${sum.discount ? `<div class="sum__off"><dt>${esc(sale.name)} (${sale.percent}% off${sum.cash ? ', bouquet cash not included' : ''})</dt><dd>-${money(sum.discount)}</dd></div>` : ''}
        <div><dt>Delivery</dt><dd>${delivery}</dd></div>
        <div class="sum__total"><dt>Total${typeof fee === 'number' ? '' : state === undefined ? '' : ' before delivery'}</dt><dd>${money(sum.total + (fee || 0))}</dd></div>
      </dl>${note}`;
  }

  function renderBag() {
    const sum = totals();
    for (const badge of $$('[data-bag-count]')) { badge.textContent = sum.count; badge.hidden = !sum.count; }
    for (const badge of $$('[data-saved-count]')) { badge.textContent = saved.length; badge.hidden = !saved.length; }
    const lines = linesHTML();
    const waiting = !GG.loaded && !GG.failed && (Object.keys(bag).length || gifts.length);
    $('[data-bag-lines]').innerHTML = lines
      ? `<ul class="lines">${lines}</ul>`
      : waiting ? '<p class="loading" role="status">Loading your bag…</p>'
      : `<div class="empty"><p class="empty__title">Your bag is empty.</p><p>Pieces you add will wait here, even if you close the page.</p><a class="btn btn--primary" href="/shop.html">Shop all jewelry</a></div>`;
    $('[data-bag-foot]').innerHTML = lines
      ? `${sumHTML()}
         <a class="btn btn--primary btn--block" href="/checkout.html">Checkout</a>
         <a class="btn btn--ghost btn--block" href="${wa(orderText())}" target="_blank" rel="noopener">${icon('chat')} Order on WhatsApp</a>`
      : '';
  }

  function sync(message) {
    for (const key of Object.keys(bag)) if (!bag[key]) delete bag[key];
    write('ggz-bag', bag);
    write('ggz-gifts', gifts);
    write('ggz-saved', saved);
    renderBag();
    document.dispatchEvent(new CustomEvent('gg:change'));
    if (message) say(message);
  }

  /* How many of a product are already spoken for by gifts in the bag. */
  const inGifts = id => gifts.reduce((count, gift) => count + gift.pieces.filter(key => split(key).id === id).length, 0);
  const inBag = id => Object.entries(bag).reduce((count, [key, qty]) => count + (split(key).id === id ? qty : 0), 0);

  function addToBag(id, size, qty = 1) {
    const product = byId(id);
    if (!product || product.stock === 0) return false;
    const key = size ? id + '::' + size : String(id);
    const room = stockOf(product) - inGifts(id) - inBag(id);
    const added = Math.max(0, Math.min(qty, room));
    bag[key] = (bag[key] || 0) + added;
    sync(added ? `${product.name} added to your bag.` : 'That is all we have of this piece.');
    const badge = $('[data-bag-count]');
    badge.classList.remove('bump');
    void badge.offsetWidth;
    badge.classList.add('bump');
    return true;
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-add],[data-save],[data-open-bag],[data-close-bag],[data-qty],[data-remove],[data-remove-gift],[data-reload],[data-copy]');
    if (!target) return;
    const data = target.dataset;
    if ('add' in data) {
      addToBag(data.add, data.size || '', Number(data.count) || 1);
    } else if ('save' in data) {
      const id = data.save;
      const on = !saved.includes(id);
      saved = on ? [...saved, id] : saved.filter(item => item !== id);
      for (const button of $$(`[data-save="${CSS.escape(id)}"]`)) button.setAttribute('aria-pressed', String(on));
      sync(on ? 'Saved. Find it under the heart at the top.' : 'Removed from your saved pieces.');
    } else if ('openBag' in data) {
      $('#bag').showModal();
    } else if ('closeBag' in data) {
      $('#bag').close();
    } else if ('qty' in data) {
      const product = byId(split(data.key).id);
      const step = Number(data.qty);
      const room = product ? stockOf(product) - inGifts(product.id) - inBag(product.id) : 0;
      bag[data.key] = Math.max(0, (bag[data.key] || 0) + (step > 0 ? Math.min(step, Math.max(0, room)) : step));
      const scope = target.closest('[data-bag-lines],[data-summary]');
      sync();
      (scope?.querySelector(`[data-key="${CSS.escape(data.key)}"][data-qty="${data.qty}"]:not(:disabled)`) || scope?.querySelector('button, a'))?.focus();
    } else if ('remove' in data) {
      delete bag[data.remove];
      sync('Removed from your bag.');
    } else if ('removeGift' in data) {
      gifts.splice(Number(data.removeGift), 1);
      sync('Gift package removed.');
    } else if ('reload' in data) {
      location.reload();
    } else if ('copy' in data) {
      navigator.clipboard?.writeText(data.copy).then(() => say('Copied.'), () => say('Copy it by hand: ' + data.copy));
    }
  });

  /* ---------- home ---------- */
  /* Home sections ease up into place as they scroll into view. Content is only held back once
     this has started, so nothing is hidden if scripts fail, and people who ask their device
     for less motion see everything straight away. */
  function reveal() {
    if (!('IntersectionObserver' in window) || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const sections = $$('main > section:not(.hero)');
    const watch = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        watch.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    for (const section of sections) {
      section.classList.add('reveal');
      watch.observe(section);
    }
    document.documentElement.classList.add('reveal-on');
  }

  function home() {
    reveal();
    const dust = $('.dust');
    if (dust) {
      let seed = 7;
      const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      let dots = '';
      for (let i = 0; i < 90; i++) {
        const heavy = random() < 0.62;
        const angle = heavy ? (random() < 0.5 ? 2.1 : 5.4) + (random() - 0.5) * 1.5 : random() * Math.PI * 2;
        const radius = 47 + (random() - 0.35) * 6;
        dots += `<circle cx="${(50 + Math.cos(angle) * radius).toFixed(2)}" cy="${(50 + Math.sin(angle) * radius).toFixed(2)}" r="${(0.12 + random() * 0.42).toFixed(2)}" opacity="${(0.35 + random() * 0.65).toFixed(2)}"/>`;
      }
      dust.innerHTML = `<svg viewBox="-4 -4 108 108" fill="currentColor" aria-hidden="true">${dots}</svg>`;
    }

    const render = () => {
      const state = saleState();
      const seal = $('.seal');
      seal.hidden = state === 'over';
      seal.classList.toggle('is-live', state === 'active');
      if (state !== 'over') {
        $('.seal b').textContent = GG.sale.percent + '%';
        $('.seal__when').textContent = state === 'upcoming' ? 'from ' + saleStart() : 'until ' + saleEnd();
        seal.setAttribute('aria-label', `${GG.sale.name}: ${GG.sale.percent}% off all orders, ${saleDates()}`);
      }
      const perk = $('[data-sale-perk]');
      perk.hidden = state === 'over' || !GG.sale.giftOver;
      if (!perk.hidden) perk.querySelector('span').innerHTML = `Free gift over ${money(GG.sale.giftOver)} <small>${saleDates()}</small>`;
      const phone = $('[data-wa]');
      phone.href = wa('Hello Zee, I would like to place an order.');
      phone.textContent = waDisplay();

      if (waiting($('#collection-grid'), 5)) { $('#cats').innerHTML = ''; $('#sets').innerHTML = ''; return; }
      $('#cats').innerHTML = GG.types.map(type => {
        const list = GG.catalog.filter(product => product.type === type);
        if (!list.length) return '';
        const face = type === 'Combos' ? '/assets/img/model.jpg' : src(list[0]);
        const unit = type === 'Combos' ? (list.length === 1 ? 'set' : 'sets') : (list.length === 1 ? 'piece' : 'pieces');
        return `<a class="cat" href="/shop.html?type=${type}">
          <span class="ring"><img src="${esc(face)}" alt="" width="512" height="512" loading="lazy"></span>
          <span class="cat__name">${type}</span>
          <span class="cat__count">${list.length} ${unit}</span>
        </a>`;
      }).join('');
      const featured = pieces().slice(0, 5);
      $('#collection-grid').innerHTML = featured.map((product, index) => card(product, index === 0 && featured.length === 5)).join('') ||
        '<div class="empty"><p class="empty__title">New pieces are on their way.</p><p>Message Zee on WhatsApp to hear first.</p></div>';
      const sets = availableFirst(GG.catalog.filter(product => product.members));
      $('.sets').hidden = !sets.length;
      $('#sets').innerHTML = sets.map(product => {
        const members = product.members.map(byId).filter(Boolean);
        return `<li class="set">
          <a class="set__media" href="${link(product)}" tabindex="-1" aria-hidden="true">${media(product)}</a>
          <div class="set__main">
            <h3><a href="${link(product)}">${esc(product.name)}</a></h3>
            <p>${members.map(member => esc(member.name)).join(' + ')}</p>
          </div>
          <div class="set__buy">${priceHTML(product)}
            ${product.stock === 0 ? '<span class="soldout">Sold out</span>' : `<button class="btn btn--primary" type="button" data-add="${esc(product.id)}">Add set to bag</button>`}
          </div>
        </li>`;
      }).join('');
    };
    render();
    return render;
  }

  /* ---------- shop ---------- */
  function shop() {
    const state = {
      type: GG.types.includes(params.get('type')) ? params.get('type') : '',
      q: params.get('q') || '',
      saved: params.get('saved') === '1',
      sort: 'featured',
      max: 0
    };
    const root = $('#shop');
    const ceiling = () => Math.max(...GG.catalog.map(product => product.price));
    const floor = () => Math.min(...GG.catalog.map(product => product.price));

    function frame() {
      if (waiting(root)) return false;
      if (!GG.catalog.length) {
        root.innerHTML = '<div class="empty"><p class="empty__title">New pieces are on their way.</p><p>Message Zee on WhatsApp to hear first.</p></div>';
        return false;
      }
      state.max = ceiling();
      root.innerHTML = `
        <aside class="filters" aria-label="Filters">
          <div class="filters__group">
            <h2>Category</h2>
            <div class="chips" data-types></div>
          </div>
          <div class="filters__group">
            <h2><label for="max">Price</label></h2>
            <input id="max" type="range" min="${floor()}" max="${ceiling()}" step="500" value="${ceiling()}">
            <output for="max" data-max></output>
          </div>
          <label class="check"><input type="checkbox" data-saved ${state.saved ? 'checked' : ''}><span>Saved pieces only</span></label>
          <button class="textlink" type="button" data-reset>Clear filters</button>
        </aside>
        <div class="results">
          <div class="toolbar">
            <p data-count role="status"></p>
            <label class="sort">Sort
              <select data-sort>
                <option value="featured">Featured</option>
                <option value="low">Price: low to high</option>
                <option value="high">Price: high to low</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>
          <div class="grid" data-grid></div>
        </div>`;
      $('[data-sort]').value = state.sort;
      return true;
    }

    function draw() {
      if (!$('[data-grid]')) return;
      const terms = state.q.toLowerCase().trim().split(/\s+/).filter(Boolean);
      let list = GG.catalog.filter(product => {
        const text = `${product.name} ${product.type}`.toLowerCase();
        return (!state.type || product.type === state.type) &&
          product.price <= state.max &&
          (!state.saved || saved.includes(String(product.id))) &&
          terms.every(term => text.includes(term));
      });
      list = availableFirst(list);
      if (state.sort === 'low') list = availableFirst([...list].sort((a, b) => a.price - b.price));
      if (state.sort === 'high') list = availableFirst([...list].sort((a, b) => b.price - a.price));
      if (state.sort === 'name') list = availableFirst([...list].sort((a, b) => a.name.localeCompare(b.name)));

      $('#shop-title').textContent = state.saved ? 'Saved pieces' : state.type || 'The collection';
      $('[data-types]').innerHTML = ['', ...GG.types].map(type => {
        const count = GG.catalog.filter(product => !type || product.type === type).length;
        return count ? `<button type="button" data-type="${type}" aria-pressed="${state.type === type}">${type || 'All'} <span>${count}</span></button>` : '';
      }).join('');
      $('[data-max]').textContent = 'Up to ' + money(state.max);
      $('[data-count]').textContent = `${list.length} ${list.length === 1 ? 'result' : 'results'}${state.q ? ' for “' + state.q + '”' : ''}`;
      $('[data-grid]').innerHTML = list.map(product => card(product)).join('') ||
        `<div class="empty">
          <p class="empty__title">${state.saved && !saved.length ? 'Nothing saved yet.' : 'No jewelry matches those filters.'}</p>
          <p>${state.saved && !saved.length ? 'Tap the heart on any piece to keep it here.' : 'Try a different category or a higher price.'}</p>
          <button class="btn btn--primary" type="button" data-reset>Show all jewelry</button>
        </div>`;
      const query = new URLSearchParams();
      if (state.type) query.set('type', state.type);
      if (state.q) query.set('q', state.q);
      if (state.saved) query.set('saved', '1');
      history.replaceState(null, '', '/shop.html' + (query.size ? '?' + query : ''));
    }

    if (frame()) draw();
    root.addEventListener('click', event => {
      const type = event.target.closest('[data-type]');
      if (type) { state.type = type.dataset.type; draw(); }
      if (event.target.closest('[data-reset]')) {
        Object.assign(state, { type: '', q: '', saved: false, max: ceiling() });
        $('#max').value = state.max;
        $('[data-saved]').checked = false;
        $('.search input').value = '';
        draw();
      }
    });
    root.addEventListener('input', event => {
      if (event.target.id === 'max') { state.max = Number(event.target.value); draw(); }
    });
    root.addEventListener('change', event => {
      if (event.target.matches('[data-saved]')) { state.saved = event.target.checked; draw(); }
      if (event.target.matches('[data-sort]')) { state.sort = event.target.value; draw(); }
    });
    const search = $('.search');
    search.addEventListener('submit', event => { event.preventDefault(); state.q = search.q.value; draw(); });
    search.q.addEventListener('input', () => { state.q = search.q.value; draw(); });
    document.addEventListener('gg:change', () => { if (state.saved) draw(); });
    return () => { if (frame()) draw(); };
  }

  /* ---------- product ---------- */
  function product() {
    const root = $('#product');
    let size = '';
    let qty = 1;
    let shot = 0;

    function draw() {
      if (waiting(root)) return;
      const item = byId(params.get('id'));
      if (item && item.type === GG.giftType) { location.replace('/gift.html'); return; }
      if (!item) {
        document.title = 'Piece not found | ' + GG.brand.name;
        root.innerHTML = `<div class="empty empty--page"><h1>We couldn't find that piece.</h1><p>It may have sold out or the link may be old.</p><a class="btn btn--primary" href="/shop.html">Shop all jewelry</a></div>`;
        return;
      }
      document.title = `${item.name} | ${GG.brand.name}`;
      const name = esc(item.name);
      const members = item.members ? item.members.map(byId).filter(Boolean) : [];
      /* One row of suggestions: sets this piece comes in first, then other pieces, then other sets. */
      const sets = GG.catalog.filter(product => product.members?.includes(item.id));
      const rest = GG.catalog.filter(product => product.id !== item.id && !sets.includes(product) && !item.members?.includes(product.id));
      const others = availableFirst([...sets, ...rest.filter(product => !product.members), ...rest.filter(product => product.members)]).slice(0, 4);
      const soldOut = item.stock === 0;
      /* Gallery slides: each photo (or the set's pieces when it has no photo of its own), then the video. */
      const slides = [...(item.photos.length ? item.photos.map(photo => ({ photo })) : [{ set: true }]), ...(item.video ? [{ video: item.video }] : [])];
      const gallery = slides.length > 1;
      const poster = item.photos[0] ? photoUrl(item.photos[0]) : members[0] ? src(members[0]) : '';
      const state = saleState();
      const most = Math.max(1, stockOf(item) - inGifts(item.id) - inBag(item.id));
      qty = Math.min(qty, most);
      shot = Math.min(shot, slides.length - 1);
      const current = slides[shot];

      const playing = $('.pdp__video', root);
      root.innerHTML = `
        <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/shop.html?type=${esc(item.type)}">${esc(item.type)}</a><span aria-hidden="true">/</span><span aria-current="page">${name}</span></nav>
        <div class="pdp">
          <div class="pdp__media${isCluster(item) ? ' pdp__media--set' : ''}">
            ${current.video
              ? `<video class="pdp__video" src="/media/video/${esc(current.video.id)}" data-video="${esc(current.video.id)}"${poster ? ` poster="${esc(poster)}"` : ''} controls muted playsinline preload="none" aria-label="Video of ${name}"></video>`
              : gallery && current.photo ? `<img src="${esc(photoUrl(current.photo))}" alt="${name}" width="800" height="800">` : media(item, true)}
            ${gallery ? `<div class="thumbs">${slides.map((slide, index) => `<button type="button" data-shot="${index}" aria-pressed="${index === shot}" aria-label="${slide.video ? 'Video' : 'Photo ' + (index + 1)} of ${name}">${
                slide.video ? `${poster ? `<img src="${esc(poster)}" alt="" width="80" height="80">` : ''}<span class="thumbs__play">${icon('play')}</span>`
                : `<img src="${esc(slide.photo ? photoUrl(slide.photo) : poster)}" alt="" width="80" height="80">`}</button>`).join('')}</div>` : ''}
          </div>
          <div class="pdp__info">
            <h1>${name}</h1>
            ${members.length ? `<p class="pdp__count">A set of ${members.length} pieces</p>` : ''}
            <p class="pdp__price">${priceHTML(item)}${state === 'upcoming' ? `<span class="pdp__soon">${money(off(item.price))} from ${saleStart()} with the ${esc(GG.sale.name)}</span>` : ''}</p>
            ${item.description ? `<p class="pdp__blurb">${esc(item.description)}</p>` : ''}
            ${!soldOut && item.stock <= 3 ? `<p class="pdp__low">Only ${item.stock} left.</p>` : ''}
            ${item.sizes.length ? `
              <fieldset class="sizes">
                <legend>${item.type === 'Rings' ? 'Ring size' : 'Option'} <span data-size-hint>${size ? '' : '(choose one)'}</span></legend>
                <div class="chips">${item.sizes.map(option => `<button type="button" data-size-pick="${esc(option)}" aria-pressed="${size === option}">${esc(option)}</button>`).join('')}</div>
                ${item.type === 'Rings' ? `<details class="guide">
                  <summary>Ring size guide</summary>
                  <p>Measure the inside of a ring that fits you, straight across the middle. These are standard US sizes; ask Zee if you are unsure.</p>
                  <table><thead><tr><th>US size</th><th>Inside diameter</th></tr></thead>
                  <tbody>${GG.ringSizes.map(([label, mm]) => `<tr><td>${label}</td><td>${mm}</td></tr>`).join('')}</tbody></table>
                </details>` : ''}
              </fieldset>` : ''}
            <div class="buy">
              <div class="qty qty--lg" role="group" aria-label="Quantity">
                <button type="button" data-step="-1" aria-label="One fewer"${qty <= 1 ? ' disabled' : ''}>${icon('minus')}</button>
                <span aria-live="polite">${qty}</span>
                <button type="button" data-step="1" aria-label="One more"${qty >= most ? ' disabled' : ''}>${icon('plus')}</button>
              </div>
              <button class="btn btn--primary btn--grow" type="button" data-buy ${soldOut ? 'disabled' : ''}>${soldOut ? 'Sold out' : 'Add to bag'}</button>
              <button class="save save--inline" type="button" data-save="${esc(item.id)}" aria-pressed="${saved.includes(String(item.id))}" aria-label="Save ${name}">${icon('heart')}</button>
            </div>
            <p class="field__error" data-buy-error hidden></p>
            ${soldOut ? (onNotifyList(item.id)
              ? `<p class="notify notify--done" role="status">${icon('check')} You're on the list. We'll email you once when the ${name} is back.</p>`
              : `<form class="notify" data-notify novalidate>
                  <label for="notify-email">Email me when it's back</label>
                  <div class="notify__row">
                    <input id="notify-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" aria-describedby="notify-hint notify-error">
                    <button class="btn btn--primary" type="submit">Notify me</button>
                  </div>
                  <p class="field__error" id="notify-error" hidden></p>
                  <p class="field__hint" id="notify-hint">One email when this piece is back, then we delete your address. <a class="textlink" href="/privacy.html" target="_blank">Privacy policy</a></p>
                </form>`) : ''}
            <a class="btn btn--ghost btn--block" href="${wa(`Hello Zee, I'd like to ${soldOut ? 'ask about' : 'order'} the ${item.name} (${money(item.price)}) from ${GG.brand.name}.`)}" target="_blank" rel="noopener">${icon('chat')} ${soldOut ? 'Ask Zee about this piece' : 'Order this on WhatsApp'}</a>
            <ul class="facts">
              <li>${icon('truck')} <span>We deliver nationwide. <a href="/help.html">Delivery and returns</a></span></li>
              <li>${icon('gift')} <span>Add it to a gift with a note in the <a href="/gift.html">Gift Builder</a></span></li>
              ${state !== 'over' ? `<li>${icon('tag')} <span>${GG.sale.percent}% off all orders, ${saleDates()}</span></li>` : ''}
            </ul>
          </div>
        </div>
        ${members.length ? `
          <section class="band" aria-labelledby="inside-title">
            <h2 id="inside-title">What's in the set</h2>
            <div class="grid grid--four">${members.map(member => card(member)).join('')}</div>
          </section>` : ''}
        ${others.length ? `
          <section class="band" aria-labelledby="look-title">
            <h2 id="look-title">Complete the look</h2>
            <div class="grid grid--four">${others.map(other => card(other)).join('')}</div>
          </section>` : ''}`;
      const video = $('.pdp__video', root);
      if (video && playing && playing.dataset.video === video.dataset.video) video.replaceWith(playing);
      else if (video) {
        /* A phone that can't play this format gets a plain note instead of a broken player. */
        video.addEventListener('error', () => {
          const note = document.createElement('p');
          note.className = 'pdp__video-error';
          note.textContent = "This video can't play on this device. The photos show the piece.";
          video.replaceWith(note);
        });
      }
    }

    draw();
    root.addEventListener('submit', async event => {
      if (!event.target.matches('[data-notify]')) return;
      event.preventDefault();
      const item = byId(params.get('id'));
      const form = event.target;
      const email = form.email.value.trim();
      const error = $('#notify-error');
      const fail = message => { error.textContent = message; error.hidden = false; form.email.setAttribute('aria-invalid', 'true'); form.email.focus(); };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Enter your email address, like you@example.com.');
      const button = $('button', form);
      button.disabled = true;
      try {
        const response = await fetch('/api/restock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, email }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) { button.disabled = false; return fail(data.error || (response.status === 429 ? 'Too many tries. Wait a minute and try again.' : 'That didn\'t work. Try again.')); }
        write('ggz-notify', [...new Set([...read('ggz-notify', []).filter(id => typeof id === 'string'), item.id])].slice(-50));
        draw();
        say("You're on the list.");
      } catch {
        button.disabled = false;
        fail('We could not reach the store. Check your connection and try again.');
      }
    });
    root.addEventListener('click', event => {
      const item = byId(params.get('id'));
      if (!item) return;
      const pick = event.target.closest('[data-size-pick]');
      const step = event.target.closest('[data-step]');
      const thumb = event.target.closest('[data-shot]');
      if (pick) { size = pick.dataset.sizePick; draw(); $(`[data-size-pick="${CSS.escape(size)}"]`).focus(); }
      if (step) {
        qty = Math.max(1, qty + Number(step.dataset.step));
        draw();
        ($(`[data-step="${step.dataset.step}"]:not(:disabled)`) || $('[data-buy]')).focus();
      }
      if (thumb) {
        shot = Number(thumb.dataset.shot);
        draw();
        $(`[data-shot="${shot}"]`).focus();
        $('.pdp__video', root)?.play().catch(() => {});
      }
      if (event.target.closest('[data-buy]')) {
        if (item.sizes.length && !size) {
          const error = $('[data-buy-error]');
          error.textContent = item.type === 'Rings' ? 'Choose a ring size first, then add it to your bag.' : 'Choose an option first, then add it to your bag.';
          error.hidden = false;
          $('[data-size-pick]').focus();
          return;
        }
        addToBag(item.id, size, qty);
        qty = 1;
        draw();
        $('#bag').showModal();
      }
    });
    return draw;
  }

  /* ---------- gift builder ---------- */
  function gift() {
    const root = $('#gift');
    /* id -> { size, cash }. Cash is only for gift items where the customer chooses the amount (money bouquets). */
    const chosen = new Map();
    let note = '';

    const available = product => stockOf(product) - inGifts(product.id) - inBag(product.id) > 0;
    const cashLimits = product => ({ min: product.cashMin || 0, max: product.cashMax || 5000000 });
    const cashProblem = product => {
      const { cash } = chosen.get(product.id) || {};
      const { min, max } = cashLimits(product);
      if (!Number.isInteger(cash) || cash <= 0) return `Enter how much cash goes in the ${product.name}.`;
      if (cash < min) return `The ${product.name} needs at least ${money(min)} in cash.`;
      if (cash > max) return `The ${product.name} can hold up to ${money(max)} in cash.`;
      return '';
    };
    const lineFor = product => {
      const pick = chosen.get(product.id) || {};
      return {
        label: product.name + (pick.size ? ` · ${optionText(pick.size)}` : '') + (product.cashMin != null && pick.cash > 0 ? ` · ${money(pick.cash)} cash` : ''),
        price: product.price + (product.cashMin != null ? Math.max(0, pick.cash || 0) : 0)
      };
    };

    function option(product) {
      const on = chosen.has(product.id);
      const pick = chosen.get(product.id) || {};
      const cash = product.cashMin != null;
      return `<div class="option${on ? ' is-on' : ''}">
        <label>
          <input type="checkbox" value="${esc(product.id)}" ${on ? 'checked' : ''}>
          <img src="${esc(src(product))}" alt="" width="512" height="512" loading="lazy">
          <span class="option__tick">${icon('check')}</span>
          <span class="option__name">${esc(product.name)}</span>
          <span class="option__price">${cash ? `${money(product.price)} + your cash` : money(product.price)}</span>
        </label>
        ${on && product.sizes.length ? `<label class="option__size">${product.type === 'Rings' ? 'Ring size' : 'Option'}
          <select data-gift-size="${esc(product.id)}">
            <option value="">Choose</option>
            ${product.sizes.map(size => `<option${pick.size === size ? ' selected' : ''}>${esc(size)}</option>`).join('')}
          </select></label>` : ''}
        ${on && cash ? `<label class="option__cash">Cash inside (₦)
          <input type="number" inputmode="numeric" min="${cashLimits(product).min}" step="500" data-gift-cash="${esc(product.id)}" value="${pick.cash || ''}" placeholder="${cashLimits(product).min ? 'At least ' + cashLimits(product).min.toLocaleString('en-NG') : 'Amount'}">
        </label>
        ${saleState() !== 'over' ? `<p class="field__hint">The ${GG.sale.percent}% sale comes off the bouquet fee, not the cash inside.</p>` : ''}` : ''}
      </div>`;
    }

    function box() {
      const picked = [...chosen.keys()].map(byId).filter(Boolean);
      const total = picked.reduce((sum, product) => sum + lineFor(product).price, 0);
      const problem = picked.map(product => product.sizes.length && !chosen.get(product.id).size
        ? `Choose ${product.type === 'Rings' ? 'a ring size' : 'an option'} for the ${product.name}.`
        : product.cashMin != null ? cashProblem(product) : '').find(Boolean);
      return `
        <h2>Your gift</h2>
        ${picked.length ? `<ul class="giftbox__list">${picked.map(product => `<li><span class="ring"><img src="${esc(src(product))}" alt="" width="56" height="56"></span><span>${esc(lineFor(product).label)}</span><span>${money(lineFor(product).price)}</span></li>`).join('')}</ul>` : '<p class="giftbox__empty">Tick what you want to give and it will gather here.</p>'}
        ${note.trim() ? `<blockquote class="giftbox__note">“${esc(note.trim())}”</blockquote>` : ''}
        <dl class="sum"><div class="sum__total"><dt>Gift subtotal</dt><dd>${money(total)}</dd></div></dl>
        <button class="btn btn--gold btn--block" type="submit" ${picked.length && !problem ? '' : 'disabled'}>Add gift to bag</button>
        ${problem ? `<p class="field__hint">${esc(problem)}</p>` : ''}`;
    }
    const refreshBox = () => { const aside = $('.giftbox', root); if (aside) aside.innerHTML = box(); };

    function draw() {
      if (waiting(root)) return;
      const jewelry = pieces().filter(available);
      const extras = (GG.giftItems || []).filter(available);
      for (const id of [...chosen.keys()]) if (![...jewelry, ...extras].some(product => product.id === id)) chosen.delete(id);
      let step = 0;
      root.innerHTML = `
        <form class="gift" novalidate>
          <div class="gift__pick">
            ${jewelry.length ? `<fieldset>
              <legend>${++step}. Choose jewelry${jewelry.some(product => product.type === 'Lip Gloss') ? ' and lip gloss' : ''}</legend>
              <div class="gift__options">${jewelry.map(option).join('')}</div>
            </fieldset>` : ''}
            ${extras.length ? `<fieldset class="gift__extras">
              <legend>${++step}. Add gift extras</legend>
              <p class="field__hint">Flowers, money bouquets and more, only available in the Gift Builder.</p>
              <div class="gift__options">${extras.map(option).join('')}</div>
            </fieldset>` : ''}
            ${!jewelry.length && !extras.length ? '<p class="field__hint">Nothing is available to gift right now.</p>' : ''}
            <div class="field">
              <label for="gift-note">${++step}. Add a gift note <span class="optional">(optional)</span></label>
              <textarea id="gift-note" maxlength="200" rows="4" placeholder="Write a short message to go with the gift">${esc(note)}</textarea>
              <p class="field__hint"><span data-left>${200 - note.length}</span> characters left</p>
            </div>
          </div>
          <aside class="giftbox" aria-live="polite">${box()}</aside>
        </form>`;
    }

    draw();
    root.addEventListener('change', event => {
      const tick = event.target.closest('input[type="checkbox"]');
      const select = event.target.closest('[data-gift-size]');
      if (tick) {
        if (tick.checked) chosen.set(tick.value, { size: '', cash: 0 }); else chosen.delete(tick.value);
        draw();
        const cashField = tick.checked && $(`[data-gift-cash="${CSS.escape(tick.value)}"]`);
        (cashField || $(`input[value="${CSS.escape(tick.value)}"]`))?.focus();
      }
      if (select) {
        chosen.get(select.dataset.giftSize).size = select.value;
        refreshBox();
      }
    });
    root.addEventListener('input', event => {
      if (event.target.id === 'gift-note') {
        note = event.target.value.slice(0, 200);
        $('[data-left]').textContent = 200 - note.length;
      }
      const cashField = event.target.closest('[data-gift-cash]');
      if (cashField) {
        chosen.get(cashField.dataset.giftCash).cash = Math.round(Number(cashField.value) || 0);
        refreshBox();
      }
    });
    root.addEventListener('focusout', event => {
      if (event.target.id === 'gift-note') refreshBox();
    });
    root.addEventListener('submit', event => {
      event.preventDefault();
      if (!chosen.size || $('.giftbox button[type="submit"]', root).disabled) return;
      gifts.push({
        pieces: [...chosen].map(([id, pick]) => {
          const product = byId(id);
          const cash = product?.cashMin != null ? pick.cash : 0;
          return cash ? `${id}::${pick.size}::${cash}` : pick.size ? `${id}::${pick.size}` : id;
        }),
        note: note.trim()
      });
      chosen.clear();
      note = '';
      sync('Gift package added to your bag.');
      draw();
      $('#bag').showModal();
    });
    return draw;
  }

  /* ---------- checkout ---------- */
  function checkout() {
    const root = $('#checkout');
    let placed = false;
    let sending = false;
    const fields = [
      ['name', 'Full name', 'text', 'name', value => value.trim().length > 1 ? '' : 'Enter your name so Zee knows who the order is for.'],
      ['phone', 'Phone number', 'tel', 'tel', value => /^(?:\+?234|0)[789][01]\d{8}$/.test(value.replace(/[\s-]/g, '')) ? '' : 'Enter a Nigerian mobile number, like 0803 123 4567.'],
      ['email', 'Email', 'email', 'email', value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? '' : value.trim() ? 'That email looks incomplete. Check it and try again.' : 'Enter your email. We send your payment confirmation there.'],
      ['address', 'Delivery address', 'text', 'street-address', value => value.trim().length > 5 ? '' : 'Enter the street address to deliver to.'],
      ['city', 'City or town', 'text', 'address-level2', value => value.trim() ? '' : 'Enter the city or town.']
    ];

    function summary() {
      const lines = linesHTML();
      $('[data-summary]').innerHTML = lines ? `<h2>Your order</h2><ul class="lines">${lines}</ul>${sumHTML($('#state')?.value || '')}` : '';
    }

    /* Older orders were placed before the LGA was asked for, so it may be missing. */
    const where = delivery => [delivery.address, delivery.city, delivery.lga && delivery.lga + ' LGA', delivery.state].filter(Boolean).join(', ');

    function receipt(order, bank) {
      remember(order);
      const first = esc(order.customer.name.split(/\s+/)[0]);
      const rows = [
        ...order.items.map(line => `<li class="line line--plain"><div class="line__main"><p class="line__name">${esc(line.name)}</p><p class="line__meta">${line.size ? esc(optionText(line.size).replace(/^s/, 'S')) + ' · ' : ''}Quantity ${line.qty}</p></div><p class="line__price">${money(line.price * line.qty)}</p></li>`),
        ...order.gifts.map(gift => `<li class="line line--plain"><div class="line__main"><p class="line__name">Gift package</p><p class="line__meta">${gift.pieces.map(piece => esc(pieceText(piece.name, piece.size, piece.cash))).join(', ')}</p>${gift.note ? `<p class="line__note">“${esc(gift.note)}”</p>` : ''}</div><p class="line__price">${money(gift.pieces.reduce((sum, piece) => sum + piece.price, 0))}</p></li>`)
      ].join('');
      const fee = order.delivery.fee;
      const message = [
        `Hello Zee, I just placed order ${order.ref} on the ${GG.brand.name} website.`,
        '',
        ...order.items.map(line => `• ${line.qty} x ${line.name}${line.size ? ' (size ' + line.size + ')' : ''}`),
        ...order.gifts.map(gift => `• Gift: ${gift.pieces.map(piece => pieceText(piece.name, piece.size, piece.cash)).join(', ')}`),
        '',
        `Total: ${money(order.total)}${fee === null ? ' before delivery' : ''}`,
        `Name: ${order.customer.name}`,
        `Deliver to: ${where(order.delivery)}`,
        bank ? 'I am sending my payment proof here.' : 'Please confirm delivery and how to pay.'
      ].join('\n');
      root.innerHTML = `
        <div class="done">
          <span class="done__mark">${icon('check')}</span>
          <h1 tabindex="-1">Thank you, ${first}.</h1>
          <p>Your order <strong class="ref">${esc(order.ref)}</strong> has reached Zee.${order.freeGift ? ' A free gift is coming with it.' : ''}</p>
          ${bank ? `
            <div class="pay">
              <h2>Pay ${money(order.total)} by bank transfer</h2>
              <dl>
                <div><dt>Bank</dt><dd>${esc(bank.bankName)}</dd></div>
                <div><dt>Account name</dt><dd>${esc(bank.accountName)}</dd></div>
                <div><dt>Account number</dt><dd><span class="pay__number">${esc(bank.accountNumber)}</span> <button class="textlink" type="button" data-copy="${esc(bank.accountNumber)}">Copy</button></dd></div>
                <div><dt>Reference</dt><dd class="ref">${esc(order.ref)}</dd></div>
              </dl>
              <p>${fee === null ? 'Zee will confirm the delivery fee on WhatsApp before you pay. ' : ''}After paying, send your payment proof on WhatsApp so Zee can send your order.</p>
            </div>` : `<p>Send it to Zee on WhatsApp now and she will confirm ${fee === null ? 'the delivery fee and ' : ''}how to pay.</p>`}
          <div class="done__actions">
            <a class="btn btn--primary" href="${wa(message)}" target="_blank" rel="noopener">${icon('chat')} ${bank ? 'Send payment proof on WhatsApp' : 'Confirm order on WhatsApp'}</a>
            ${order.token ? `<a class="btn btn--ghost" href="${esc(trackHref(order))}">Track your order</a>` : `<a class="btn btn--ghost" href="/shop.html">Keep shopping</a>`}
          </div>
          <p class="done__note">When Zee confirms your payment, we email <strong>${esc(order.customer.email)}</strong>${order.token ? ' and your order page updates' : ''}. Check your spam folder if it doesn't arrive.</p>
          <div class="summary summary--done">
            <h2>Order ${esc(order.ref)}</h2>
            <ul class="lines">${rows}</ul>
            <dl class="sum">
              <div><dt>Subtotal</dt><dd>${money(order.subtotal)}</dd></div>
              ${order.discount ? `<div class="sum__off"><dt>${esc(order.saleName)}</dt><dd>-${money(order.discount)}</dd></div>` : ''}
              <div><dt>Delivery</dt><dd>${fee === null ? 'Zee will confirm' : fee === 0 ? 'Free' : money(fee)}</dd></div>
              <div class="sum__total"><dt>Total${fee === null ? ' before delivery' : ''}</dt><dd>${money(order.total)}</dd></div>
              <div><dt>Deliver to</dt><dd>${esc(where(order.delivery))}</dd></div>
            </dl>
          </div>
        </div>`;
    }

    function draw() {
      if (placed) return;
      const last = read('ggz-last-order', null, sessionStorage);
      if (last && params.get('order') === last.order?.ref) { placed = true; receipt(last.order, last.bank); return; }
      if (waiting(root)) return;
      if (!totals().count) {
        root.innerHTML = `<div class="empty empty--page"><h1>Your bag is empty.</h1><p>Add a piece, a set or a gift, then come back to check out.</p><a class="btn btn--primary" href="/shop.html">Shop all jewelry</a></div>`;
        return;
      }
      if ($('#checkout-form')) { summary(); return; }
      root.innerHTML = `
        <div class="checkout">
          <form id="checkout-form" novalidate>
            <h1>Checkout</h1>
            <p class="demo">Payment is by bank transfer. Place your order, then you will see how to pay and can send your proof to Zee on WhatsApp.</p>
            <p class="alert" role="alert" data-order-error hidden></p>
            <fieldset>
              <legend>Your details</legend>
              ${fields.slice(0, 3).map(field).join('')}
            </fieldset>
            <fieldset>
              <legend>Delivery</legend>
              ${fields.slice(3).map(field).join('')}
              <div class="field">
                <label for="state">State</label>
                <select id="state" name="state" autocomplete="address-level1" aria-describedby="state-error">
                  <option value="">Choose a state</option>
                  ${GG.states.map(name => `<option>${name}</option>`).join('')}
                </select>
                <p class="field__error" id="state-error" hidden></p>
              </div>
              <div class="field">
                <label for="lga">Local government area</label>
                <select id="lga" name="lga" aria-describedby="lga-error" disabled>
                  <option value="">Choose a state first</option>
                </select>
                <p class="field__error" id="lga-error" hidden></p>
              </div>
              <div class="field">
                <label for="note">Delivery note <span class="optional">(optional)</span></label>
                <textarea id="note" name="note" rows="3" maxlength="300" placeholder="Landmark, gate code, best time to call"></textarea>
              </div>
            </fieldset>
            <label class="consent"><input type="checkbox" id="agree" name="agree" aria-describedby="agree-error">
              <span>I agree to the <a href="/terms.html" target="_blank">terms of service</a> and <a href="/refunds.html" target="_blank">refund policy</a>, and I'm 18 or older or have a parent or guardian's permission.</span></label>
            <p class="field__error" id="agree-error" hidden></p>
            <button class="btn btn--primary btn--block" type="submit">Place order</button>
            <p class="field__hint">We use your details only to process, deliver and update you about this order. See our <a class="textlink" href="/privacy.html" target="_blank">privacy policy</a>.</p>
          </form>
          <aside class="summary" data-summary aria-label="Order summary"></aside>
        </div>`;
      summary();
    }

    function field([id, label, type, autocomplete, , optional]) {
      return `<div class="field">
        <label for="${id}">${label}${optional ? ' <span class="optional">(optional)</span>' : ''}</label>
        <input id="${id}" name="${id}" type="${type}" autocomplete="${autocomplete}" aria-describedby="${id}-error">
        <p class="field__error" id="${id}-error" hidden></p>
      </div>`;
    }

    function check(input) {
      const rule = input.id === 'agree'
        ? () => input.checked ? '' : 'Tick the box to agree before placing your order.'
        : input.id === 'state'
        ? value => value ? '' : 'Choose the state to deliver to.'
        : input.id === 'lga'
          ? value => value ? '' : $('#state').value ? 'Choose the local government area.' : 'Choose a state first, then the local government area.'
          : fields.find(([id]) => id === input.id)?.[4];
      if (!rule) return true;
      const message = rule(input.value);
      const error = $('#' + input.id + '-error');
      error.textContent = message;
      error.hidden = !message;
      input.setAttribute('aria-invalid', String(Boolean(message)));
      return !message;
    }

    function problem(message, withWhatsApp) {
      const box = $('[data-order-error]');
      box.innerHTML = esc(message) + (withWhatsApp ? ` <a href="${wa(orderText())}" target="_blank" rel="noopener">Send the order on WhatsApp instead</a>.` : '');
      box.hidden = false;
      box.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    draw();
    root.addEventListener('focusout', event => {
      if (event.target.matches('#checkout-form input, #checkout-form select') && event.target.value) check(event.target);
    });
    /* The LGA list follows the chosen state. Changing state clears the LGA so a mismatched pair can't be sent. */
    function fillLgas() {
      const lga = $('#lga');
      const state = $('#state').value;
      const list = (window.GG_LGAS || {})[state] || [];
      lga.innerHTML = state
        ? `<option value="">Choose a local government area</option>${list.map(name => `<option>${esc(name)}</option>`).join('')}`
        : '<option value="">Choose a state first</option>';
      lga.disabled = !state;
      $('#lga-error').hidden = true;
      lga.removeAttribute('aria-invalid');
    }
    root.addEventListener('change', event => {
      if (event.target.id === 'state') { fillLgas(); summary(); }
    });
    root.addEventListener('submit', async event => {
      event.preventDefault();
      if (sending) return;
      const form = event.target.elements;
      const inputs = $$('input, select', event.target);
      const bad = inputs.filter(input => !check(input));
      if (bad.length) { bad[0].focus(); return; }
      const button = $('button[type="submit"]', event.target);
      sending = true;
      button.disabled = true;
      button.textContent = 'Placing your order…';
      $('[data-order-error]').hidden = true;
      const body = {
        name: form.name.value, phone: form.phone.value, email: form.email.value,
        address: form.address.value, city: form.city.value, state: form.state.value, lga: form.lga.value, note: form.note.value,
        agree: form.agree.checked,
        items: Object.entries(bag).map(([key, qty]) => ({ ...split(key), qty })),
        gifts: gifts.map(gift => ({ pieces: gift.pieces.map(split), note: gift.note }))
      };
      try {
        const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 409) await load();
          problem(data.error || (response.status === 429 ? 'Too many tries in a short time. Wait a minute and try again.' : 'The order did not go through. Try again in a moment.'), response.status >= 500);
          return;
        }
        placed = true;
        bag = {};
        gifts = [];
        sync();
        write('ggz-last-order', data, sessionStorage);
        history.replaceState(null, '', '/checkout.html?order=' + encodeURIComponent(data.order.ref));
        params.set('order', data.order.ref);
        receipt(data.order, data.bank);
        $('.done h1').focus();
        window.scrollTo(0, 0);
        load();
      } catch {
        problem('We could not reach the store. Check your connection and try again.', true);
      } finally {
        sending = false;
        if (!placed) { button.disabled = false; button.textContent = 'Place order'; }
      }
    });
    document.addEventListener('gg:change', draw);
    return draw;
  }

  /* ---------- blog ---------- */
  const postDate = iso => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' }).format(new Date(iso));
  const postHref = post => '/post.html?slug=' + encodeURIComponent(post.id);
  const coverUrl = post => post.cover ? photoUrl(post.cover) : '/assets/img/model.jpg';

  /* Post text is plain text: blank lines separate paragraphs, "## " starts a subheading, "- " starts a list item.
     Everything is escaped first; only web links are turned into links. */
  function renderBody(text) {
    const inline = value => esc(value).replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]]/g, url => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
    return text.split(/\n{2,}/).map(block => block.trim()).filter(Boolean).map(block => {
      if (block.startsWith('## ')) return `<h2>${inline(block.slice(3))}</h2>`;
      const lines = block.split('\n');
      if (lines.every(line => line.startsWith('- '))) return `<ul>${lines.map(line => `<li>${inline(line.slice(2))}</li>`).join('')}</ul>`;
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    }).join('');
  }

  const postCard = (post, lead) => `<article class="post-card${lead ? ' post-card--lead' : ''}">
    <a class="post-card__media" href="${postHref(post)}" tabindex="-1" aria-hidden="true"><img src="${esc(coverUrl(post))}" alt="" width="800" height="600" loading="lazy"></a>
    <div class="post-card__body">
      <p class="post-card__date">${postDate(post.publishedAt)}</p>
      <h3><a href="${postHref(post)}">${esc(post.title)}</a></h3>
      <p>${esc(post.excerpt)}</p>
    </div>
  </article>`;

  async function fetchBlog(slug) {
    const response = await fetch('/api/blog' + (slug ? '?slug=' + encodeURIComponent(slug) : ''));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('blog');
    return response.json();
  }

  /* Home: the latest three posts, only when there are any. */
  async function homeBlog() {
    const section = $('#journal');
    if (!section) return;
    try {
      const data = await fetchBlog();
      if (!data.posts.length) return;
      $('#journal-list').innerHTML = data.posts.slice(0, 3).map(post => postCard(post)).join('');
      section.hidden = false;
    } catch { /* the home page stands on its own without the blog */ }
  }

  function blog() {
    const root = $('#blog');
    root.innerHTML = '<p class="loading" role="status">Loading…</p>';
    fetchBlog().then(data => {
      root.innerHTML = data.posts.length
        ? `<div class="posts">${data.posts.map((post, index) => postCard(post, index === 0)).join('')}</div>`
        : `<div class="empty"><p class="empty__title">The first post is on its way.</p><p>Styling notes, gift ideas and new arrivals from Zee will appear here.</p><a class="btn btn--primary" href="/shop.html">Shop the collection</a></div>`;
    }).catch(() => {
      root.innerHTML = `<div class="empty"><p class="empty__title">We couldn't load the blog.</p><p>Check your connection and try again.</p><button class="btn btn--primary" type="button" data-reload>Try again</button></div>`;
    });
  }

  function post() {
    const root = $('#post');
    const slug = params.get('slug');
    root.innerHTML = '<p class="loading" role="status">Loading…</p>';
    const missing = () => {
      document.title = 'Post not found | ' + GG.brand.name;
      root.innerHTML = `<div class="empty empty--page"><h1>We couldn't find that post.</h1><p>It may have been taken down, or the link may be old.</p><a class="btn btn--primary" href="/blog.html">All posts</a></div>`;
    };
    if (!slug) return missing();
    fetchBlog(slug).then(data => {
      if (!data) return missing();
      const { post: item, newer, older } = data;
      document.title = `${item.title} | ${GG.brand.name}`;
      $('meta[name="description"]')?.setAttribute('content', item.excerpt);
      root.innerHTML = `
        <article class="article">
          <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/blog.html">Blog</a></nav>
          <header class="article__head">
            <p class="post-card__date">${postDate(item.publishedAt)}</p>
            <h1>${esc(item.title)}</h1>
          </header>
          ${item.cover ? `<img class="article__cover" src="${esc(photoUrl(item.cover))}" alt="" width="1200" height="800">` : ''}
          <div class="article__body">${renderBody(item.body)}</div>
          <footer class="article__foot">
            <a class="btn btn--primary" href="/shop.html">Shop the collection</a>
            <a class="btn btn--ghost" href="${wa('Hello Zee, I just read "' + item.title + '" on your blog.')}" target="_blank" rel="noopener">${icon('chat')} Talk to Zee</a>
          </footer>
          ${newer || older ? `<nav class="article__more" aria-label="More posts">
            ${older ? `<a href="${postHref(older)}"><span>Older post</span>${esc(older.title)}</a>` : '<span></span>'}
            ${newer ? `<a class="article__newer" href="${postHref(newer)}"><span>Newer post</span>${esc(newer.title)}</a>` : ''}
          </nav>` : ''}
        </article>`;
    }).catch(() => {
      root.innerHTML = `<div class="empty"><p class="empty__title">We couldn't load this post.</p><p>Check your connection and try again.</p><button class="btn btn--primary" type="button" data-reload>Try again</button></div>`;
    });
  }

  /* Pieces this browser asked to hear about. Forgotten once the piece is back on sale. */
  const onNotifyList = id => { const list = read('ggz-notify', []); return Array.isArray(list) && list.includes(id); };

  /* ---------- order tracking ---------- */
  const trackHref = order => `/order.html?ref=${encodeURIComponent(order.ref)}&t=${encodeURIComponent(order.token)}`;

  /* Orders placed on this device, so a customer can find them again without the link. */
  function remember(order) {
    if (!order.token) return;
    const list = read('ggz-orders', []);
    const mine = (Array.isArray(list) ? list : []).filter(item => item?.ref && item.ref !== order.ref);
    write('ggz-orders', [{ ref: order.ref, token: order.token, at: order.createdAt }, ...mine].slice(0, 10));
  }

  const STEPS = [['new', 'Order placed'], ['paid', 'Payment confirmed'], ['shipped', 'On its way'], ['delivered', 'Delivered']];
  const stamp = iso => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }).format(new Date(iso));

  function track() {
    const root = $('#track');

    function lookup(message) {
      document.title = 'Track your order | ' + GG.brand.name;
      const mine = read('ggz-orders', []);
      root.innerHTML = `
        <div class="track-find">
          <h1>Track your <em>order</em></h1>
          <p>Enter your order number and the phone number you ordered with.</p>
          <form novalidate>
            ${message ? `<p class="alert" role="alert">${esc(message)}</p>` : ''}
            <div class="field"><label for="t-ref">Order number</label><input id="t-ref" name="ref" placeholder="GGZ-1A2B3C" autocomplete="off" autocapitalize="characters" required></div>
            <div class="field"><label for="t-phone">Phone number</label><input id="t-phone" name="phone" type="tel" autocomplete="tel" placeholder="0803 123 4567" required></div>
            <button class="btn btn--primary btn--block" type="submit">Find my order</button>
          </form>
          ${Array.isArray(mine) && mine.length ? `<div class="track-mine"><h2>Ordered on this device</h2><ul>${mine.map(item =>
            `<li><a href="${esc(trackHref(item))}"><span class="ref">${esc(item.ref)}</span><span>${item.at ? stamp(item.at) : ''}</span></a></li>`).join('')}</ul></div>` : ''}
        </div>`;
      $('form', root).addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.target.elements;
        const button = $('button', event.target);
        button.disabled = true;
        button.textContent = 'Looking…';
        try {
          const response = await fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: form.ref.value, phone: form.phone.value }) });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) return lookup(data.error || (response.status === 429 ? 'Too many tries. Wait a minute and try again.' : 'Something went wrong. Try again.'));
          if (data.token) history.replaceState(null, '', trackHref({ ref: data.order.ref, token: data.token }));
          show(data);
        } catch {
          lookup('We could not reach the store. Check your connection and try again.');
        }
      });
    }

    function show({ order, bank, whatsapp, token }) {
      remember({ ...order, token });
      document.title = `Order ${order.ref} | ${GG.brand.name}`;
      const reached = new Map(order.history.map(step => [step.status, step.at]));
      const cancelled = order.status === 'cancelled';
      const current = STEPS.findIndex(([status]) => status === order.status);
      const fee = order.delivery.fee;
      const message = encodeURIComponent(`Hello Zee, I'm asking about my order ${order.ref}.`);
      const rows = [
        ...order.items.map(line => `<li class="line line--plain"><div class="line__main"><p class="line__name">${esc(line.name)}</p><p class="line__meta">${line.size ? esc(optionText(line.size).replace(/^s/, 'S')) + ' · ' : ''}Quantity ${line.qty}</p></div><p class="line__price">${money(line.price * line.qty)}</p></li>`),
        ...order.gifts.map(gift => `<li class="line line--plain"><div class="line__main"><p class="line__name">Gift package</p><p class="line__meta">${gift.pieces.map(piece => esc(pieceText(piece.name, piece.size, piece.cash))).join(', ')}</p>${gift.note ? `<p class="line__note">“${esc(gift.note)}”</p>` : ''}</div><p class="line__price">${money(gift.pieces.reduce((sum, piece) => sum + piece.price, 0))}</p></li>`)
      ].join('');
      const lead = cancelled ? 'This order was cancelled. Message Zee on WhatsApp if you have questions.'
        : { new: 'Zee has your order and is waiting for your payment.', paid: 'Your payment is confirmed. Zee is getting your order ready.', shipped: 'Your order is on its way to you.', delivered: 'Your order has been delivered. Enjoy your pieces.' }[order.status];
      root.innerHTML = `
        <div class="track">
          <p class="track__ref ref">Order ${esc(order.ref)}</p>
          <h1>${cancelled ? 'Order cancelled' : `Hello, ${esc(order.customer.name)}.`}</h1>
          <p class="track__lead">${lead}</p>
          ${cancelled ? '' : `<ol class="steps">${STEPS.map(([status, label], index) => {
            const done = index <= current;
            return `<li class="step${done ? ' is-done' : ''}${index === current ? ' is-now' : ''}"${index === current ? ' aria-current="step"' : ''}>
              <span class="step__dot">${done ? icon('check') : ''}</span>
              <span class="step__label">${label}</span>
              <span class="step__at">${reached.has(status) ? stamp(reached.get(status)) : ''}</span>
            </li>`;
          }).join('')}</ol>`}
          ${bank ? `
            <div class="pay">
              <h2>Pay ${money(order.total)} by bank transfer</h2>
              <dl>
                <div><dt>Bank</dt><dd>${esc(bank.bankName)}</dd></div>
                <div><dt>Account name</dt><dd>${esc(bank.accountName)}</dd></div>
                <div><dt>Account number</dt><dd><span class="pay__number">${esc(bank.accountNumber)}</span> <button class="textlink" type="button" data-copy="${esc(bank.accountNumber)}">Copy</button></dd></div>
                <div><dt>Reference</dt><dd class="ref">${esc(order.ref)}</dd></div>
              </dl>
              <p>${fee === null ? 'Zee will confirm the delivery fee on WhatsApp before you pay. ' : ''}After paying, send your payment proof on WhatsApp. This page and your email update once Zee confirms it.</p>
            </div>` : ''}
          <div class="done__actions">
            <a class="btn btn--primary" href="https://wa.me/${esc(whatsapp)}?text=${message}" target="_blank" rel="noopener">${icon('chat')} Message Zee on WhatsApp</a>
            <a class="btn btn--ghost" href="/shop.html">Keep shopping</a>
          </div>
          <div class="summary summary--done">
            <h2>Your order</h2>
            <ul class="lines">${rows}</ul>
            <dl class="sum">
              <div><dt>Subtotal</dt><dd>${money(order.subtotal)}</dd></div>
              ${order.discount ? `<div class="sum__off"><dt>${esc(order.saleName)}</dt><dd>-${money(order.discount)}</dd></div>` : ''}
              <div><dt>Delivery</dt><dd>${fee === null ? 'Zee will confirm' : fee === 0 ? 'Free' : money(fee)}</dd></div>
              <div class="sum__total"><dt>Total${fee === null ? ' before delivery' : ''}</dt><dd>${money(order.total)}</dd></div>
              <div><dt>Deliver to</dt><dd>${esc([order.delivery.address, order.delivery.city, order.delivery.lga && order.delivery.lga + ' LGA', order.delivery.state].filter(Boolean).join(', '))}</dd></div>
            </dl>
          </div>
        </div>`;
    }

    async function load() {
      const ref = params.get('ref');
      const token = params.get('t');
      if (!ref || !token) return lookup();
      root.innerHTML = '<p class="loading" role="status">Loading your order…</p>';
      try {
        const response = await fetch(`/api/track?ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(token)}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return lookup(response.status === 404 ? 'That order link is not valid any more. Find your order with its number and your phone number.' : 'Something went wrong. Try again.');
        show(data);
      } catch {
        lookup('We could not reach the store. Check your connection and try again.');
      }
    }
    load();
  }

  /* ---------- help ---------- */
  function help() {
    const render = () => {
      const fees = GG.delivery;
      const fee = value => value === null ? 'confirmed with your order' : value === 0 ? 'free' : money(value);
      $('#help-delivery').innerHTML = `
        <p>We deliver nationwide.</p>
        <ul class="plain">
          <li>Within Lagos: ${fee(fees.lagos)}</li>
          <li>Other states: ${fee(fees.other)}</li>
        </ul>
        ${GG.policies.delivery ? paragraphs(GG.policies.delivery) : ''}`;
      $('#help-returns').innerHTML = GG.policies.returns
        ? paragraphs(GG.policies.returns)
        : `<p>If an item arrives faulty, damaged or not what you ordered, tell Zee within 3 days of delivery and she'll replace it or refund you. Read the full <a href="/refunds.html">refund policy</a>.</p>`;
      $('#help-sizes').innerHTML = `<table class="sizes-table"><thead><tr><th>US size</th><th>Inside diameter</th></tr></thead>
        <tbody>${GG.ringSizes.map(([label, mm]) => `<tr><td>${label}</td><td>${mm}</td></tr>`).join('')}</tbody></table>
        <p>These are standard US ring sizes. If you are between sizes or unsure which scale a ring uses, ask Zee before you order.</p>`;
      for (const anchor of $$('[data-wa-help]')) { anchor.href = wa('Hello Zee, I have a question about ' + GG.brand.name + '.'); anchor.textContent = 'WhatsApp ' + waDisplay(); }
    };
    const paragraphs = text => text.split(/\n+/).filter(Boolean).map(line => `<p>${esc(line)}</p>`).join('');
    render();
    return render;
  }

  /* ---------- visit counting ---------- */
  /* One anonymous page view for the owner's Visitors page: the page, the product being looked at,
     and where the visit came from. No cookies and nothing stored in the browser.
     Browsers that ask not to be tracked (Global Privacy Control or Do Not Track) are not counted. */
  function countVisit() {
    try {
      if (navigator.globalPrivacyControl || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
      const path = page === 'lost' ? '/404.html'
        : location.pathname.replace(/\/index(\.html)?$/, '/').replace(/^(\/[a-z0-9-]+)$/i, '$1.html');
      let source = params.get('utm_source') || params.get('src') || '';
      if (!source && document.referrer) {
        const from = new URL(document.referrer);
        if (from.host !== location.host) source = from.hostname;
      }
      const body = JSON.stringify({ page: path, product: page === 'product' ? params.get('id') || '' : '', source: source.slice(0, 80) });
      if (navigator.sendBeacon?.('/api/hit', new Blob([body], { type: 'application/json' }))) return;
      fetch('/api/hit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    } catch { /* counting must never break the page */ }
  }

  /* ---------- start ---------- */
  const cached = read('ggz-store', null);
  if (cached && Array.isArray(cached.products)) apply(cached);
  chrome();
  const redraw = ({ home, shop, product, gift, checkout, help, track, blog, post })[page]?.();
  if (page === 'home') homeBlog();
  renderBag();

  function refresh() {
    saleBar();
    $('#site-nav').innerHTML = navHTML();
    drawFooter();
    redraw?.();
    renderBag();
  }

  async function load() {
    try {
      const response = await fetch('/api/store');
      if (!response.ok) throw new Error('store');
      const data = await response.json();
      if (!Array.isArray(data.products)) throw new Error('store');
      apply(data);
      write('ggz-store', data);
      tidyBag();
    } catch {
      GG.failed = !GG.loaded;
    }
    refresh();
  }
  load();
  countVisit();
})();
