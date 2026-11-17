(() => {
  'use strict';

  const app = document.getElementById('app');
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const money = amount => '₦' + Math.round(amount || 0).toLocaleString('en-NG');
  const when = iso => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }).format(new Date(iso));
  const photoUrl = photo => /^[a-f0-9-]{36}$/.test(photo) ? '/media/' + photo : '/' + photo;
  const TYPES = ['Earrings', 'Necklaces', 'Bracelets', 'Rings', 'Lip Gloss', 'Combos', 'Gift items'];
  const GIFT_TYPE = 'Gift items';
  const EMAIL_LABEL = { paid: 'Payment confirmed', shipped: 'On its way', delivered: 'Delivered' };
  const STATUS = { new: 'New', paid: 'Paid', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
  /* Nigeria keeps one clock all year, so sale times are entered and shown in Lagos time. */
  const toLagos = iso => new Date(Date.parse(iso) + 3600000).toISOString().slice(0, 16);
  const fromLagos = value => value ? value + ':00+01:00' : '';

  const paths = {
    orders: '<path d="M5.500 8.500h13l1 11.500h-15l1-11.500Z"/><path d="M9 8.500V7a3 3 0 0 1 6 0v1.500"/>',
    blog: '<path d="M5 4.500h10.500L19 8v11.500H5z"/><path d="M8.500 10h7M8.500 13.500h7M8.500 17h4.500"/>',
    products: '<path d="M12 3.500 20 8v8l-8 4.500L4 16V8l8-4.500Z"/><path d="M4 8l8 4.500L20 8M12 12.500v8"/>',
    settings: '<path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h12M20 17h0"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="17" r="2"/>',
    store: '<path d="M4 10.500 5.500 4.500h13L20 10.500M5 10.500V19.500h14V10.500M4 10.500h16M9.500 19.500v-5h5v5"/>',
    out: '<path d="M14 4.500h5.500v15H14M10.500 8 6.500 12l4 4M6.500 12h9"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    image: '<path d="M4 5h16v14H4z"/><path d="m4 15.500 4.500-4.500 4 4 3-3 4.500 4.500"/><circle cx="15.500" cy="9" r="1.500"/>',
    chat: '<path d="M4 5h16v11.500H10L5.500 20v-3.500H4V5Z"/><path d="M8 9.500h8M8 12.500h5"/>'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;

  const state = { email: '', orders: [], products: [], settings: null, filter: 'open', productFilter: 'all', query: '', dirty: false, timer: 0 };

  let toastTimer;
  function say(message) {
    const toast = $('.toast');
    toast.textContent = message;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 3000);
  }

  async function api(path, options = {}) {
    const init = { method: options.method || 'GET', headers: {}, credentials: 'same-origin' };
    if (options.body instanceof Blob) { init.body = options.body; init.headers['Content-Type'] = options.body.type; }
    else if (options.body) { init.body = JSON.stringify(options.body); init.headers['Content-Type'] = 'application/json'; }
    let response;
    try { response = await fetch('/api/admin/' + path, init); }
    catch { throw new Error('No connection. Check your internet and try again.'); }
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && !options.gate) { gate(false); throw new Error(data.error || 'Sign in again.'); }
    if (!response.ok) throw new Error(data.error || (response.status === 429 ? 'Too many requests. Wait a minute.' : 'Something went wrong. Try again.'));
    return data;
  }

  /* Runs a button's action with a busy label, and reports any error in a toast. */
  async function busy(button, label, action) {
    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = label;
    try { return await action(); }
    catch (error) { say(error.message); }
    finally { if (button.isConnected) { button.disabled = false; button.innerHTML = original; } }
  }

  /* ---------- sign in and first-time setup ---------- */
  function gate(setupNeeded, mode) {
    clearInterval(state.timer);
    const setup = mode === 'setup' || (setupNeeded && mode !== 'login');
    app.innerHTML = `
      <div class="gate">
        <aside class="gate__side" aria-label="Glossy Gems by Zee">
          <img src="/assets/img/logo-badge.jpg" width="110" height="110" alt="Glossy Gems by Zee">
          <p>Your store, your orders, your pieces.</p>
        </aside>
        <main class="gate__form">
          <form novalidate>
            <h1>${setup ? 'Set up your dashboard' : 'Sign in'}</h1>
            <p class="lede">${setup ? 'Enter the setup code you were given, then choose the email and password you will sign in with.' : 'Manage orders, products and the sale.'}</p>
            ${setup ? `<div class="field"><label for="code">Setup code</label><input id="code" name="code" autocomplete="one-time-code" required></div>` : ''}
            <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required></div>
            <div class="field"><label for="password">${setup ? 'Choose a password' : 'Password'}</label><input id="password" name="password" type="password" autocomplete="${setup ? 'new-password' : 'current-password'}" required>
              ${setup ? '<p class="field__hint">At least 10 characters.</p>' : ''}</div>
            ${setup ? `<div class="field"><label for="again">Type the password again</label><input id="again" name="again" type="password" autocomplete="new-password" required></div>` : ''}
            <p class="form-error" role="alert" hidden></p>
            <button class="btn btn--primary btn--block" type="submit">${setup ? 'Create my account' : 'Sign in'}</button>
            ${setupNeeded ? '' : `<p class="gate__alt">${setup
              ? '<button class="textlink" type="button" data-mode="login">Back to sign in</button>'
              : 'Forgot your password? <button class="textlink" type="button" data-mode="setup">Reset it with a new setup code</button>'}</p>`}
          </form>
        </main>
      </div>`;
    const form = $('form');
    const error = $('.form-error');
    $('[data-mode]')?.addEventListener('click', event => gate(setupNeeded, event.target.dataset.mode));
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const fields = form.elements;
      error.hidden = true;
      const fail = message => { error.textContent = message; error.hidden = false; };
      if (setup && fields.password.value !== fields.again.value) return fail('The two passwords do not match.');
      const button = $('button[type="submit"]', form);
      button.disabled = true;
      try {
        const body = { email: fields.email.value, password: fields.password.value, code: fields.code?.value };
        const result = await api(setup ? 'setup' : 'login', { method: 'POST', body, gate: true });
        state.email = result.email;
        start();
      } catch (problem) {
        fail(problem.message);
        button.disabled = false;
      }
    });
    $('input', form).focus();
  }

  /* ---------- shell and routing ---------- */
  function shell() {
    app.innerHTML = `
      <div class="shell">
        <nav class="side" aria-label="Dashboard">
          <div class="side__brand"><img src="/assets/img/logo-badge.jpg" width="44" height="44" alt=""><span>Glossy Gems<small>Dashboard</small></span></div>
          <a href="#/orders" data-nav="orders">${icon('orders')}<span>Orders</span><span class="side__badge" data-new hidden></span></a>
          <a href="#/products" data-nav="products">${icon('products')}<span>Products</span></a>
          <a href="#/blog" data-nav="blog">${icon('blog')}<span>Blog</span></a>
          <a href="#/settings" data-nav="settings">${icon('settings')}<span>Settings</span></a>
          <div class="side__foot">
            <a href="/" target="_blank" rel="noopener">${icon('store')}<span>Store</span></a>
            <button type="button" data-signout>${icon('out')}<span>Sign out</span></button>
          </div>
        </nav>
        <main class="main" id="view" tabindex="-1"></main>
      </div>`;
  }

  document.addEventListener('click', async event => {
    if (!event.target.closest('[data-signout]')) return;
    if (state.dirty && !confirm('You have unsaved changes. Sign out anyway?')) return;
    state.dirty = false;
    await api('logout', { method: 'POST', gate: true }).catch(() => {});
    gate(false);
  });

  let lastHash = '';
  function route() {
    if (!$('#view')) return;
    const hash = location.hash || '#/orders';
    if (state.dirty && hash !== lastHash) {
      if (!confirm('You have unsaved changes. Leave without saving?')) { history.replaceState(null, '', lastHash); return; }
      state.dirty = false;
    }
    lastHash = hash;
    const [, section = 'orders', ...rest] = hash.split('/');
    const id = decodeURIComponent(rest.join('/'));
    for (const link of $$('[data-nav]')) {
      if (link.dataset.nav === section) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    }
    const view = $('#view');
    view.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
    if (section === 'products') return id ? productEditor(view, id) : productList(view);
    if (section === 'settings') return settingsView(view);
    if (section === 'blog') return id ? postEditor(view, id) : postList(view);
    return id ? orderDetail(view, id) : orderList(view);
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', event => { if (state.dirty) event.preventDefault(); });

  function badge() {
    const fresh = state.orders.filter(order => order.status === 'new').length;
    const mark = $('[data-new]');
    if (!mark) return;
    mark.textContent = fresh;
    mark.hidden = !fresh;
    document.title = (fresh ? `(${fresh}) ` : '') + 'Store dashboard | Glossy Gems by Zee';
  }

  async function loadOrders() {
    state.orders = (await api('orders')).orders;
    badge();
  }

  /* ---------- orders ---------- */
  const orderFilters = [
    ['open', 'Needs action', order => order.status === 'new' || order.status === 'paid'],
    ['new', 'New', order => order.status === 'new'],
    ['paid', 'Paid', order => order.status === 'paid'],
    ['shipped', 'Shipped', order => order.status === 'shipped'],
    ['delivered', 'Delivered', order => order.status === 'delivered'],
    ['cancelled', 'Cancelled', order => order.status === 'cancelled'],
    ['all', 'All', () => true]
  ];

  function orderList(view) {
    const draw = () => {
      const [, , test] = orderFilters.find(([key]) => key === state.filter);
      const list = state.orders.filter(test);
      const fresh = state.orders.filter(order => order.status === 'new').length;
      const toShip = state.orders.filter(order => order.status === 'paid').length;
      view.innerHTML = `
        <div class="head"><div><h1>Orders</h1>
          <p>${state.orders.length ? `${fresh} new, ${toShip} paid and waiting to ship.` : 'Orders placed on the store appear here.'}</p></div></div>
        <div class="tabs" role="group" aria-label="Filter orders">${orderFilters.map(([key, label, check]) =>
          `<button type="button" data-filter="${key}" aria-pressed="${state.filter === key}">${label} <span>${state.orders.filter(check).length}</span></button>`).join('')}</div>
        ${list.length ? `<div class="rows">
          <div class="row row--order row--head"><span>Order</span><span>Customer</span><span>Pieces</span><span class="row__num">Total</span><span>Status</span></div>
          ${list.map(order => `<a class="row row--order" href="#/orders/${encodeURIComponent(order.key)}">
            <span class="row__strong">${esc(order.ref)}<span class="row__sub">${when(order.createdAt)}</span></span>
            <span>${esc(order.name)}<span class="row__sub">${esc(order.phone)}</span></span>
            <span>${order.pieces}</span>
            <span class="row__num row__strong">${money(order.total)}</span>
            <span class="pill pill--${order.status}">${STATUS[order.status]}</span>
          </a>`).join('')}</div>`
        : `<div class="empty"><p class="empty__title">${state.orders.length ? 'No orders in this view.' : 'No orders yet.'}</p>
            <p>${state.orders.length ? 'Choose another filter above.' : 'When a customer checks out, the order lands here and they message you on WhatsApp.'}</p></div>`}`;
      for (const button of $$('[data-filter]', view)) button.addEventListener('click', () => { state.filter = button.dataset.filter; draw(); });
    };
    draw();
    const refresh = () => loadOrders().then(() => { if (location.hash === '' || location.hash === '#/orders') draw(); }).catch(() => {});
    refresh();
    clearInterval(state.timer);
    state.timer = setInterval(() => { if (!document.hidden && (location.hash === '' || location.hash === '#/orders')) refresh(); }, 60000);
  }

  async function orderDetail(view, key) {
    view.innerHTML = '<p class="loading" role="status">Loading the order…</p>';
    let order;
    let emailState = { on: false, key: false, sender: false };
    try { ({ order, email: emailState } = await api('order?key=' + encodeURIComponent(key))); }
    catch (error) { view.innerHTML = `<a class="back" href="#/orders">${icon('arrow')} All orders</a><div class="empty"><p class="empty__title">${esc(error.message)}</p></div>`; return; }

    let erasing = false;
    const draw = (confirming) => {
      const fee = order.delivery.fee;
      const first = order.customer.name.split(/\s+/)[0];
      const phone = order.customer.phone.replace(/^\+/, '').replace(/^0/, '234');
      const hello = encodeURIComponent(`Hello ${first}, this is Zee from Glossy Gems about your order ${order.ref}.`);
      const next = { new: ['paid', 'Mark as paid'], paid: ['shipped', 'Mark as shipped'], shipped: ['delivered', 'Mark as delivered'] }[order.status];
      view.innerHTML = `
        <a class="back" href="#/orders">${icon('arrow')} All orders</a>
        <div class="head">
          <div><h1 class="ref">${esc(order.ref)}</h1><p>Placed ${when(order.createdAt)} · <span class="pill pill--${order.status}">${STATUS[order.status]}</span></p></div>
          <div class="actions">
            ${next ? `<button class="btn btn--primary btn--small" type="button" data-status="${next[0]}">${next[1]}</button>` : ''}
            ${order.status !== 'cancelled' && order.status !== 'delivered' ? `<button class="btn btn--danger btn--small" type="button" data-ask-cancel>Cancel order</button>` : ''}
          </div>
        </div>
        ${confirming ? `<p class="confirm" role="alert">Cancel this order? The pieces go back on sale and this cannot be undone.
          <button class="btn btn--danger btn--small" type="button" data-status="cancelled">Yes, cancel it</button>
          <button class="btn btn--ghost btn--small" type="button" data-keep>Keep the order</button></p>` : ''}
        <div class="cols">
          <div>
            <section class="panel"><h2>Pieces</h2>
              <ul class="items">
                ${order.items.map(line => `<li><span>${line.qty} × ${esc(line.name)}${line.size ? `<small>Size ${esc(line.size)}</small>` : ''}</span><span>${money(line.price * line.qty)}</span></li>`).join('')}
                ${order.gifts.map(gift => `<li><span>Gift package<small>${gift.pieces.map(piece => esc(piece.name) + (piece.size ? ' (' + esc(piece.size) + ')' : '') + (piece.cash ? ` (${money(piece.cash)} cash, ${money(piece.fee)} fee)` : '')).join(', ')}</small>${gift.note ? `<em>“${esc(gift.note)}”</em>` : ''}</span><span>${money(gift.pieces.reduce((sum, piece) => sum + piece.price, 0))}</span></li>`).join('')}
              </ul>
              <dl class="kv">
                <div><dt>Subtotal</dt><dd>${money(order.subtotal)}</dd></div>
                ${order.discount ? `<div><dt>${esc(order.saleName)}</dt><dd>-${money(order.discount)}</dd></div>` : ''}
                <div><dt>Delivery</dt><dd>${fee === null ? 'Not set, agree it with the customer' : fee === 0 ? 'Free' : money(fee)}</dd></div>
                <div class="kv__total"><dt>Total${fee === null ? ' before delivery' : ''}</dt><dd>${money(order.total)}</dd></div>
              </dl>
              ${order.freeGift ? '<p class="notice">This order earned a free gift. Remember to pack one.</p>' : ''}
            </section>
            <section class="panel"><h2>Your notes</h2>
              <form data-note>
                <div class="field"><label for="note">Only you see this</label><textarea id="note" rows="3" maxlength="1000" placeholder="Payment seen, rider booked, anything to remember">${esc(order.note)}</textarea></div>
                <div class="actions"><button class="btn btn--ghost btn--small" type="submit">Save note</button></div>
              </form>
            </section>
          </div>
          <div>
            <section class="panel contact"><h2>Customer</h2>
              <p class="row__strong">${esc(order.customer.name)}</p>
              ${order.customer.phone ? `<p><a href="tel:${esc(order.customer.phone)}">${esc(order.customer.phone)}</a></p>` : ''}
              ${order.customer.email ? `<p><a href="mailto:${esc(order.customer.email)}">${esc(order.customer.email)}</a></p>` : ''}
              ${order.customer.phone ? `<p><a class="btn btn--primary btn--small" href="https://wa.me/${esc(phone)}?text=${hello}" target="_blank" rel="noopener">${icon('chat')} Message on WhatsApp</a></p>` : ''}
              ${order.track ? `<p class="track-link"><a href="${esc(order.track)}" target="_blank" rel="noopener">Customer's order page</a> <button class="textlink" type="button" data-copy-link>Copy link</button></p>` : ''}
            </section>
            <section class="panel"><h2>Emails to customer</h2>
              ${emailState.on ? '' : `<p class="notice">${emailState.key ? 'Add the address emails come from in <a href="#/settings">Settings</a>.' : 'Customer emails are not switched on yet. See Settings.'}</p>`}
              ${(order.emails || []).length ? `<ul class="items mail-log">${order.emails.slice().reverse().map(mail => `<li><span>${esc(EMAIL_LABEL[mail.status] || mail.status)}<small>${when(mail.at)}${mail.to ? ' · ' + esc(mail.to) : ''}</small>${mail.sent ? '' : `<em class="mail-fail">Not sent: ${esc(mail.reason)}</em>`}</span><span class="pill ${mail.sent ? 'pill--delivered' : 'pill--out'}">${mail.sent ? 'Sent' : 'Failed'}</span></li>`).join('')}</ul>`
                : `<p class="row__sub">${order.customer.email ? 'An email goes out when you mark this order paid, shipped or delivered.' : 'This customer gave no email address.'}</p>`}
              ${EMAIL_LABEL[order.status] && order.customer.email ? `<div class="actions"><button class="btn btn--ghost btn--small" type="button" data-resend>Send "${esc(EMAIL_LABEL[order.status])}" email again</button></div>` : ''}
            </section>
            <section class="panel"><h2>Customer data</h2>
              ${order.erasedAt
                ? `<p class="row__sub">The customer's personal details were erased on ${when(order.erasedAt)}. Items and amounts are kept for your records.</p>`
                : order.status === 'delivered' || order.status === 'cancelled'
                  ? (erasing
                    ? `<p class="confirm" role="alert">Erase this customer's name, phone, email, address and notes for good? Items and amounts stay for your records. This cannot be undone.
                        <button class="btn btn--danger btn--small" type="button" data-erase>Yes, erase</button>
                        <button class="btn btn--ghost btn--small" type="button" data-keep-data>Keep</button></p>`
                    : `<p class="row__sub">If the customer asks you to delete their data, erase it here.</p>
                       <div class="actions"><button class="btn btn--ghost btn--small" type="button" data-ask-erase>Erase customer details</button></div>`)
                  : '<p class="row__sub">You can erase the customer\'s details once the order is delivered or cancelled.</p>'}
            </section>
            <section class="panel"><h2>Deliver to</h2>
              <p>${esc(order.delivery.address)}</p>
              <p>${esc(order.delivery.city)}${order.delivery.lga ? `, ${esc(order.delivery.lga)} LGA` : ''}</p>
              <p>${esc(order.delivery.state)}</p>
              ${order.delivery.note ? `<p class="row__sub">Note: ${esc(order.delivery.note)}</p>` : ''}
            </section>
          </div>
        </div>`;
      $('[data-ask-cancel]', view)?.addEventListener('click', () => draw(true));
      $('[data-ask-erase]', view)?.addEventListener('click', () => { erasing = true; draw(false); });
      $('[data-keep-data]', view)?.addEventListener('click', () => { erasing = false; draw(false); });
      $('[data-erase]', view)?.addEventListener('click', event => busy(event.target, 'Erasing…', async () => {
        order = (await api('order', { method: 'POST', body: { key, erase: true } })).order;
        erasing = false;
        say('Customer details erased.');
        draw(false);
        loadOrders().catch(() => {});
      }));
      $('[data-keep]', view)?.addEventListener('click', () => draw(false));
      for (const button of $$('[data-status]', view)) {
        button.addEventListener('click', () => busy(button, 'Saving…', async () => {
          const result = await api('order', { method: 'POST', body: { key, status: button.dataset.status } });
          order = result.order;
          const moved = `Order ${order.ref} is now ${STATUS[order.status].toLowerCase()}.`;
          say(!result.email ? moved : result.email.sent ? `${moved} Email sent to ${order.customer.email}.` : `${moved} Email not sent: ${result.email.reason}`);
          draw(false);
          loadOrders().catch(() => {});
        }));
      }
      $('[data-resend]', view)?.addEventListener('click', event => busy(event.target, 'Sending…', async () => {
        const result = await api('order', { method: 'POST', body: { key, resend: true } });
        order = result.order;
        say(result.email?.sent ? `Email sent to ${order.customer.email}.` : `Email not sent: ${result.email?.reason || 'try again.'}`);
        draw(false);
      }));
      $('[data-copy-link]', view)?.addEventListener('click', () => {
        navigator.clipboard?.writeText(order.track).then(() => say('Link copied. Paste it to the customer on WhatsApp.'), () => say(order.track));
      });
      $('[data-note]', view).addEventListener('submit', event => {
        event.preventDefault();
        const button = $('button', event.target);
        busy(button, 'Saving…', async () => {
          order = (await api('order', { method: 'POST', body: { key, note: $('#note').value } })).order;
          say('Note saved.');
        });
      });
    };
    draw(false);
  }

  /* ---------- products ---------- */
  const productState = product => !product.published ? ['draft', 'Draft'] : product.stock === 0 ? ['out', 'Sold out'] : ['live', 'In store'];
  const thumbOf = product => {
    const photo = product.photos[0] || state.products.find(item => product.members.includes(item.id) && item.photos.length)?.photos[0];
    return photo ? `<img src="${esc(photoUrl(photo))}" alt="" width="56" height="56" loading="lazy">` : `<span class="thumb--none">${icon('image')}</span>`;
  };

  async function productList(view) {
    const filters = [
      ['all', 'All', () => true],
      ['live', 'In store', product => product.published && product.stock > 0],
      ['draft', 'Drafts', product => !product.published],
      ['out', 'Sold out', product => product.published && product.stock === 0],
      ['gift', 'Gift items', product => product.type === GIFT_TYPE]
    ];
    const draw = () => {
      const [, , test] = filters.find(([key]) => key === state.productFilter);
      const terms = state.query.toLowerCase().trim();
      const list = state.products.filter(test).filter(product => !terms || `${product.name} ${product.type}`.toLowerCase().includes(terms));
      view.innerHTML = `
        <div class="head"><div><h1>Products</h1><p>${state.products.length} in the catalogue.</p></div>
          <div class="actions"><a class="btn btn--ghost btn--small" href="#/products/new-gift">${icon('plus')} Add gift item</a><a class="btn btn--primary btn--small" href="#/products/new">${icon('plus')} Add product</a></div></div>
        ${state.products.some(product => product.sample) ? '<p class="notice">These are sample products carried over from the first site. Edit them, or delete them once your own pieces are in.</p>' : ''}
        <div class="toolrow">
          <div class="tabs" role="group" aria-label="Filter products">${filters.map(([key, label, check]) =>
            `<button type="button" data-filter="${key}" aria-pressed="${state.productFilter === key}">${label} <span>${state.products.filter(check).length}</span></button>`).join('')}</div>
          <input type="search" placeholder="Search products" aria-label="Search products" value="${esc(state.query)}">
        </div>
        ${list.length ? `<div class="rows">
          <div class="row row--product row--head"><span></span><span>Product</span><span>Category</span><span class="row__num">Price</span><span class="row__num">Stock</span><span>Status</span></div>
          ${list.map(product => { const [kind, label] = productState(product); return `<a class="row row--product" href="#/products/${encodeURIComponent(product.id)}">
            ${thumbOf(product)}
            <span class="row__strong">${esc(product.name)}</span>
            <span>${esc(product.type)}</span>
            <span class="row__num">${money(product.price)}</span>
            <span class="row__num${product.stock <= 2 ? ' low' : ''}">${product.stock}</span>
            <span class="pill pill--${kind}">${label}</span>
          </a>`; }).join('')}</div>`
        : `<div class="empty"><p class="empty__title">${state.products.length ? 'Nothing matches.' : 'No products yet.'}</p><p>${state.products.length ? 'Try another filter or search.' : 'Add your first piece to open the store.'}</p></div>`}`;
      for (const button of $$('[data-filter]', view)) button.addEventListener('click', () => { state.productFilter = button.dataset.filter; draw(); });
      const search = $('input[type="search"]', view);
      search.addEventListener('input', () => {
        state.query = search.value;
        draw();
        const again = $('input[type="search"]', view);
        again.focus();
        again.setSelectionRange(again.value.length, again.value.length);
      });
    };
    if (state.products.length) draw(); else view.innerHTML = '<p class="loading" role="status">Loading products…</p>';
    try { state.products = (await api('products')).products; draw(); }
    catch (error) { if (!state.products.length) view.innerHTML = `<div class="empty"><p class="empty__title">${esc(error.message)}</p></div>`; }
  }

  /* Phone photos are large. Shrink to 1600px on the long side before uploading. */
  /* ---------- blog ---------- */
  const shortDate = iso => iso ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' }).format(new Date(iso)) : '';

  async function postList(view) {
    view.innerHTML = '<p class="loading" role="status">Loading posts…</p>';
    let posts;
    try { posts = (await api('posts')).posts; }
    catch (error) { view.innerHTML = `<div class="empty"><p class="empty__title">${esc(error.message)}</p></div>`; return; }
    state.posts = posts;
    view.innerHTML = `
      <div class="head"><div><h1>Blog</h1><p>${posts.length ? `${posts.filter(post => post.published).length} published, ${posts.filter(post => !post.published).length} drafts.` : 'Share styling notes, gift ideas and new arrivals.'}</p></div>
        <a class="btn btn--primary btn--small" href="#/blog/new">${icon('plus')} Write a post</a></div>
      ${posts.length ? `<div class="rows">
        <div class="row row--post row--head"><span></span><span>Post</span><span>Date</span><span>Status</span></div>
        ${posts.map(post => `<a class="row row--post" href="#/blog/${encodeURIComponent(post.id)}">
          ${post.cover ? `<img src="${esc(photoUrl(post.cover))}" alt="" width="56" height="56" loading="lazy">` : `<span class="thumb--none">${icon('image')}</span>`}
          <span class="row__strong">${esc(post.title)}</span>
          <span>${shortDate(post.publishedAt || post.updatedAt)}</span>
          <span class="pill ${post.published ? 'pill--live' : 'pill--draft'}">${post.published ? 'Published' : 'Draft'}</span>
        </a>`).join('')}</div>`
      : `<div class="empty"><p class="empty__title">No posts yet.</p><p>The blog and the "From the blog" section on the home page appear once the first post is published.</p></div>`}`;
  }

  async function postEditor(view, id) {
    if (!state.posts) {
      view.innerHTML = '<p class="loading" role="status">Loading…</p>';
      try { state.posts = (await api('posts')).posts; } catch (error) { view.innerHTML = `<div class="empty"><p class="empty__title">${esc(error.message)}</p></div>`; return; }
    }
    const existing = id === 'new' ? null : state.posts.find(post => post.id === id);
    if (id !== 'new' && !existing) {
      view.innerHTML = `<a class="back" href="#/blog">${icon('arrow')} All posts</a><div class="empty"><p class="empty__title">That post no longer exists.</p></div>`;
      return;
    }
    const draft = existing ? { ...existing } : { title: '', excerpt: '', body: '', cover: '', published: false };
    let deleting = false;

    const collect = () => {
      draft.title = $('#p-title').value;
      draft.excerpt = $('#p-excerpt').value;
      draft.body = $('#p-body').value;
      draft.published = $('#p-published').checked;
    };

    const draw = () => {
      view.innerHTML = `
        <a class="back" href="#/blog">${icon('arrow')} All posts</a>
        <form novalidate>
          <div class="head"><div><h1>${existing ? esc(existing.title) : 'New post'}</h1>
            ${existing?.published ? `<p><a class="textlink" href="/post.html?slug=${encodeURIComponent(existing.id)}" target="_blank" rel="noopener">View on the store</a></p>` : ''}</div></div>
          <section class="panel">
            <div class="field"><label for="p-title">Title</label><input id="p-title" maxlength="140" value="${esc(draft.title)}" required></div>
            <div class="field"><label for="p-body">Post</label>
              <textarea id="p-body" class="post-body" rows="16" maxlength="20000" placeholder="Write your post here.">${esc(draft.body)}</textarea>
              <p class="field__hint">Leave an empty line between paragraphs. Start a line with "## " for a subheading, or "- " for a list. Web links become clickable.</p></div>
            <div class="field"><label for="p-excerpt">Short summary <span class="optional">(optional)</span></label>
              <textarea id="p-excerpt" rows="2" maxlength="300" placeholder="Shown on the blog page. Leave empty to use the start of the post.">${esc(draft.excerpt)}</textarea></div>
          </section>
          <section class="panel"><h2>Cover photo</h2>
            ${draft.cover ? `<div class="photos"><div class="photo"><img src="${esc(photoUrl(draft.cover))}" alt="Cover photo"><div class="photo__tools"><span></span><button class="textlink" type="button" data-drop-cover>Remove</button></div></div></div>` : '<p class="field__hint">Optional. A wide photo works best.</p>'}
            <div class="actions"><label class="upload"><input type="file" accept="image/jpeg,image/png,image/webp"><span class="btn btn--ghost btn--small">${icon('image')} ${draft.cover ? 'Replace photo' : 'Add a photo'}</span></label><span data-upload-status role="status"></span></div>
          </section>
          <div class="savebar">
            <label class="switch"><input type="checkbox" id="p-published" ${draft.published ? 'checked' : ''}><span>Published</span></label>
            <button class="btn btn--primary" type="submit">Save</button>
          </div>
        </form>
        ${existing ? `<div class="danger-zone">${deleting
          ? `<span class="confirm">Delete “${esc(existing.title)}” for good? <button class="btn btn--danger btn--small" type="button" data-delete-post>Yes, delete</button><button class="btn btn--ghost btn--small" type="button" data-keep-post>Keep</button></span>`
          : '<button class="textlink" type="button" data-ask-delete-post>Delete this post</button>'}</div>` : ''}`;
      const form = $('form', view);
      form.addEventListener('input', () => { state.dirty = true; });
      $('[data-drop-cover]')?.addEventListener('click', () => { collect(); draft.cover = ''; state.dirty = true; draw(); });
      $('[data-ask-delete-post]')?.addEventListener('click', () => { collect(); deleting = true; draw(); });
      $('[data-keep-post]')?.addEventListener('click', () => { collect(); deleting = false; draw(); });
      $('[data-delete-post]')?.addEventListener('click', event => busy(event.target, 'Deleting…', async () => {
        state.posts = (await api('posts/' + encodeURIComponent(existing.id), { method: 'DELETE' })).posts;
        state.dirty = false;
        say('Post deleted.');
        location.hash = '#/blog';
      }));
      $('input[type="file"]', form).addEventListener('change', async event => {
        const file = event.target.files[0];
        if (!file) return;
        collect();
        $('[data-upload-status]').textContent = 'Uploading…';
        try {
          draft.cover = (await api('photos', { method: 'POST', body: await shrink(file) })).id;
          state.dirty = true;
          draw();
          say('Photo added. Save to keep it.');
        } catch (error) { $('[data-upload-status]').textContent = ''; say(error.message); }
      });
      form.addEventListener('submit', event => {
        event.preventDefault();
        collect();
        if (!draft.title.trim()) { say('Give the post a title.'); $('#p-title').focus(); return; }
        busy($('button[type="submit"]', form), 'Saving…', async () => {
          const result = await api('posts', { method: 'POST', body: { post: draft } });
          state.posts = result.posts;
          state.dirty = false;
          say(draft.published ? 'Saved. It is live on the blog.' : 'Saved as a draft.');
          const target = '#/blog/' + encodeURIComponent(result.post.id);
          if (location.hash === target) route(); else location.hash = target;
        });
      });
    };
    draw();
    if (!existing) $('#p-title').focus();
  }

  async function shrink(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('That photo could not be read.')), 'image/jpeg', 0.86));
  }

  async function productEditor(view, id) {
    if (!state.products.length) {
      view.innerHTML = '<p class="loading" role="status">Loading…</p>';
      try { state.products = (await api('products')).products; } catch (error) { view.innerHTML = `<div class="empty"><p class="empty__title">${esc(error.message)}</p></div>`; return; }
    }
    const fresh = id === 'new' || id === 'new-gift';
    const existing = fresh ? null : state.products.find(product => product.id === id);
    if (!fresh && !existing) {
      view.innerHTML = `<a class="back" href="#/products">${icon('arrow')} All products</a><div class="empty"><p class="empty__title">That product no longer exists.</p></div>`;
      return;
    }
    const draft = existing
      ? { ...existing, photos: [...existing.photos], members: [...existing.members], sizes: [...existing.sizes], customCash: existing.cashMin != null }
      : { name: '', type: id === 'new-gift' ? GIFT_TYPE : 'Earrings', price: '', stock: 1, description: '', sizes: [], photos: [], members: [], published: false, customCash: false, cashMin: '', cashMax: '' };
    let deleting = false;

    const draw = () => {
      const combo = draft.type === 'Combos';
      const giftItem = draft.type === GIFT_TYPE;
      const cash = giftItem && draft.customCash;
      const single = state.products.filter(product => product.type !== 'Combos' && product.type !== GIFT_TYPE && product.id !== draft.id);
      view.innerHTML = `
        <a class="back" href="#/products">${icon('arrow')} All products</a>
        <form novalidate>
          <div class="head"><div><h1>${existing ? esc(existing.name) : giftItem ? 'New gift item' : 'New product'}</h1></div></div>
          <section class="panel"><h2>Details</h2>
            <div class="field"><label for="name">Name</label><input id="name" maxlength="120" value="${esc(draft.name)}" required></div>
            <div class="grid2">
              <div class="field"><label for="type">Category</label><select id="type">${TYPES.map(type => `<option${draft.type === type ? ' selected' : ''}>${type}</option>`).join('')}</select></div>
              <div class="field"><label for="price">${cash ? 'Your fee in naira' : 'Price in naira'}</label><input id="price" type="number" inputmode="numeric" min="0" step="1" value="${esc(draft.price)}">
                ${cash ? '<p class="field__hint">What you charge for making it. The cash goes on top.</p>' : ''}</div>
              <div class="field"><label for="stock">In stock</label><input id="stock" type="number" inputmode="numeric" min="0" step="1" value="${esc(draft.stock)}"></div>
            </div>
            <div class="field"><label for="description">Description <span class="optional">(optional)</span></label>
              <textarea id="description" rows="3" maxlength="600" placeholder="What it looks like, how to wear it">${esc(draft.description)}</textarea></div>
            <div class="field" ${combo ? 'hidden' : ''}><label for="sizes">${draft.type === 'Rings' ? 'Sizes' : 'Options'} <span class="optional">(optional)</span></label>
              <input id="sizes" value="${esc(draft.sizes.join(', '))}" placeholder="${draft.type === 'Rings' ? '6, 7, 8, 9' : giftItem ? 'Red, Pink, White' : 'Separate with commas'}">
              <p class="field__hint">Separate with commas. Customers must choose one before adding it.</p></div>
            ${giftItem ? '<p class="notice">Gift items appear only in the Gift Builder, never in the shop.</p>' : ''}
          </section>
          <section class="panel" ${giftItem ? '' : 'hidden'}><h2>Money bouquet</h2>
            <label class="switch"><input type="checkbox" id="custom-cash" ${draft.customCash ? 'checked' : ''}><span>Customer chooses how much cash goes in</span></label>
            <p class="field__hint">Turn this on for money bouquets. The customer types the cash amount and pays that plus your fee.</p>
            <div class="grid2" ${cash ? '' : 'hidden'}>
              <div class="field"><label for="cash-min">Smallest cash amount (₦)</label><input id="cash-min" type="number" inputmode="numeric" min="0" step="500" value="${esc(draft.cashMin ?? '')}"></div>
              <div class="field"><label for="cash-max">Largest cash amount (₦) <span class="optional">(optional)</span></label><input id="cash-max" type="number" inputmode="numeric" min="0" step="500" value="${esc(draft.cashMax ?? '')}"></div>
            </div>
          </section>
          <section class="panel" ${combo ? '' : 'hidden'}><h2>Pieces in this combo</h2>
            ${single.length ? `<div class="picks">${single.map(product => `<label class="check"><input type="checkbox" data-member value="${esc(product.id)}" ${draft.members.includes(product.id) ? 'checked' : ''}><span>${esc(product.name)}</span></label>`).join('')}</div>` : '<p class="field__hint">Add single pieces first, then build a combo from them.</p>'}
            <p class="field__hint">Choose at least two. A combo has its own price and its own stock.</p>
          </section>
          <section class="panel"><h2>Photos</h2>
            <p class="field__hint">${combo ? 'Optional for a combo. Without one, the store shows its pieces together.' : 'The first photo is the cover. Square photos look best.'}</p>
            <div class="photos">${draft.photos.map((photo, index) => `<div class="photo">
              <img src="${esc(photoUrl(photo))}" alt="Photo ${index + 1}">
              ${index === 0 ? '<span class="photo__cover">Cover</span>' : ''}
              <div class="photo__tools">${index ? `<button class="textlink" type="button" data-cover="${index}">Make cover</button>` : '<span></span>'}<button class="textlink" type="button" data-drop="${index}">Remove</button></div>
            </div>`).join('')}</div>
            <div class="actions"><label class="upload"><input type="file" accept="image/jpeg,image/png,image/webp" multiple ${draft.photos.length >= 12 ? 'disabled' : ''}><span class="btn btn--ghost btn--small">${icon('image')} Add photos</span></label><span data-upload-status role="status"></span></div>
          </section>
          <div class="savebar">
            <label class="switch"><input type="checkbox" id="published" ${draft.published ? 'checked' : ''}><span>Show in store</span></label>
            <button class="btn btn--primary" type="submit">Save</button>
          </div>
        </form>
        ${existing ? `<div class="danger-zone">${deleting
          ? `<span class="confirm">Delete ${esc(existing.name)} for good? ${esc(comboWarning())} <button class="btn btn--danger btn--small" type="button" data-delete>Yes, delete</button><button class="btn btn--ghost btn--small" type="button" data-keep>Keep</button></span>`
          : `<button class="textlink" type="button" data-ask-delete>Delete this product</button>`}</div>` : ''}`;
      wire();
    };

    /* Deleting a piece also takes it out of any combo. Say so before the owner confirms. */
    const comboWarning = () => state.products.filter(product => product.members.includes(existing.id)).map(combo =>
      combo.members.length > 2
        ? `It will also be taken out of the combo “${combo.name}”.`
        : `The combo “${combo.name}” will be left with one piece, so it will be hidden from the store until you add another.`).join(' ');

    const collect = () => {
      draft.name = $('#name').value;
      draft.type = $('#type').value;
      draft.price = $('#price').value === '' ? '' : Number($('#price').value);
      draft.stock = $('#stock').value === '' ? '' : Number($('#stock').value);
      draft.description = $('#description').value;
      draft.sizes = $('#sizes').value.split(',').map(size => size.trim()).filter(Boolean);
      draft.members = $$('[data-member]:checked').map(box => box.value);
      draft.published = $('#published').checked;
      draft.customCash = draft.type === GIFT_TYPE && $('#custom-cash').checked;
      draft.cashMin = $('#cash-min').value === '' ? '' : Number($('#cash-min').value);
      draft.cashMax = $('#cash-max').value === '' ? '' : Number($('#cash-max').value);
    };

    function wire() {
      const form = $('form', view);
      form.addEventListener('input', () => { state.dirty = true; });
      $('#type').addEventListener('change', () => { collect(); draw(); $('#type').focus(); });
      $('#custom-cash').addEventListener('change', () => { collect(); draw(); $('#custom-cash').focus(); });
      for (const button of $$('[data-cover]')) button.addEventListener('click', () => { collect(); const [photo] = draft.photos.splice(Number(button.dataset.cover), 1); draft.photos.unshift(photo); state.dirty = true; draw(); });
      for (const button of $$('[data-drop]')) button.addEventListener('click', () => { collect(); draft.photos.splice(Number(button.dataset.drop), 1); state.dirty = true; draw(); });
      $('[data-ask-delete]')?.addEventListener('click', () => { collect(); deleting = true; draw(); });
      $('[data-keep]')?.addEventListener('click', () => { collect(); deleting = false; draw(); });
      $('[data-delete]')?.addEventListener('click', event => busy(event.target, 'Deleting…', async () => {
        const result = await api('products/' + encodeURIComponent(draft.id), { method: 'DELETE' });
        state.products = result.products;
        state.dirty = false;
        say(result.hidden?.length ? `Deleted. ${result.hidden.join(', ')} is now a draft because it has one piece left.`
          : result.trimmed?.length ? `Deleted, and taken out of ${result.trimmed.join(', ')}.`
          : 'Product deleted.');
        location.hash = '#/products';
      }));
      $('input[type="file"]').addEventListener('change', async event => {
        const files = [...event.target.files].slice(0, 12 - draft.photos.length);
        const status = $('[data-upload-status]');
        collect();
        let done = 0;
        for (const file of files) {
          status.textContent = `Uploading ${done + 1} of ${files.length}…`;
          try {
            const { id: photo } = await api('photos', { method: 'POST', body: await shrink(file) });
            draft.photos.push(photo);
            state.dirty = true;
            done++;
          } catch (error) { say(`${file.name}: ${error.message}`); }
        }
        draw();
        if (done) say(done === 1 ? 'Photo added. Save to keep it.' : `${done} photos added. Save to keep them.`);
      });
      form.addEventListener('submit', event => {
        event.preventDefault();
        collect();
        if (!draft.name.trim()) { say('Give the product a name.'); $('#name').focus(); return; }
        if (!Number.isInteger(draft.price) || draft.price < 0) { say('Enter the price as a whole number of naira.'); $('#price').focus(); return; }
        if (!Number.isInteger(draft.stock) || draft.stock < 0) { say('Enter how many you have in stock.'); $('#stock').focus(); return; }
        if (draft.customCash && (!Number.isInteger(draft.cashMin) || draft.cashMin < 0)) { say('Enter the smallest cash amount a customer can choose.'); $('#cash-min').focus(); return; }
        busy($('button[type="submit"]', form), 'Saving…', async () => {
          const result = await api('products', { method: 'POST', body: { product: { ...draft, stockWas: existing?.stock } } });
          state.products = result.products;
          state.dirty = false;
          say(draft.published ? 'Saved. It is live in the store.' : 'Saved as a draft.');
          const target = '#/products/' + encodeURIComponent(result.product.id);
          if (location.hash === target) route(); else location.hash = target;
        });
      });
    }
    draw();
    if (!existing) $('#name').focus();
  }

  /* ---------- settings ---------- */
  async function settingsView(view) {
    view.innerHTML = '<p class="loading" role="status">Loading settings…</p>';
    let settings;
    let emailState;
    try { ({ settings, email: emailState } = await api('settings')); }
    catch (error) { view.innerHTML = `<div class="empty"><p class="empty__title">${esc(error.message)}</p></div>`; return; }
    const { sale, delivery, bank, contact, policies, email } = settings;
    view.innerHTML = `
      <div class="head"><div><h1>Settings</h1><p>Signed in as ${esc(state.email)}.</p></div>
        <button class="btn btn--ghost btn--small" type="button" data-signout>Sign out</button></div>
      <form data-settings novalidate>
        <section class="panel"><h2>Sale</h2>
          <label class="switch"><input type="checkbox" id="sale-on" ${sale.enabled ? 'checked' : ''}><span>Run this sale</span></label>
          <p class="field__hint">Between the two dates, every order gets the discount automatically and the store shows a countdown.</p>
          <div class="field"><label for="sale-name">Sale name</label><input id="sale-name" maxlength="60" value="${esc(sale.name)}"></div>
          <div class="grid2">
            <div class="field"><label for="sale-start">Starts <span class="optional">(Lagos time)</span></label><input id="sale-start" type="datetime-local" value="${toLagos(sale.start)}"></div>
            <div class="field"><label for="sale-end">Ends <span class="optional">(Lagos time)</span></label><input id="sale-end" type="datetime-local" value="${toLagos(sale.end)}"></div>
            <div class="field"><label for="sale-percent">Discount %</label><input id="sale-percent" type="number" inputmode="numeric" min="1" max="90" value="${esc(sale.percent)}"></div>
            <div class="field"><label for="sale-gift">Free gift for orders over ₦</label><input id="sale-gift" type="number" inputmode="numeric" min="0" value="${esc(sale.giftOver)}">
              <p class="field__hint">Use 0 for no free gift.</p></div>
          </div>
        </section>
        <section class="panel"><h2>Delivery fees</h2>
          <p class="field__hint">Leave a fee empty to agree it with each customer on WhatsApp. Use 0 for free delivery.</p>
          <div class="grid2">
            <div class="field"><label for="fee-lagos">Within Lagos ₦</label><input id="fee-lagos" type="number" inputmode="numeric" min="0" value="${esc(delivery.lagos ?? '')}"></div>
            <div class="field"><label for="fee-other">Other states ₦</label><input id="fee-other" type="number" inputmode="numeric" min="0" value="${esc(delivery.other ?? '')}"></div>
          </div>
        </section>
        <section class="panel"><h2>Bank account for payments</h2>
          <p class="field__hint">Shown to a customer only after they place an order. Leave empty to arrange payment on WhatsApp.</p>
          <div class="grid2">
            <div class="field"><label for="bank-name">Bank</label><input id="bank-name" maxlength="60" value="${esc(bank.bankName)}" autocomplete="off"></div>
            <div class="field"><label for="bank-holder">Account name</label><input id="bank-holder" maxlength="80" value="${esc(bank.accountName)}" autocomplete="off"></div>
            <div class="field"><label for="bank-number">Account number</label><input id="bank-number" inputmode="numeric" maxlength="10" value="${esc(bank.accountNumber)}" autocomplete="off"></div>
          </div>
        </section>
        <section class="panel"><h2>Contact</h2>
          <div class="grid2">
            <div class="field"><label for="c-wa">WhatsApp number</label><input id="c-wa" type="tel" value="${esc(contact.whatsapp.replace(/^234/, '0'))}"></div>
            <div class="field"><label for="c-tt">TikTok username</label><input id="c-tt" value="${esc(contact.tiktok)}"></div>
            <div class="field"><label for="c-sc">Snapchat username</label><input id="c-sc" value="${esc(contact.snapchat)}"></div>
          </div>
        </section>
        <section class="panel"><h2>Customer emails</h2>
          <p class="field__hint">Customers get an email when you mark their order paid, shipped or delivered. Emails are sent through Resend, from an address on your verified domain.</p>
          <p class="${emailState.on ? 'mail-on' : 'notice'}">${emailState.on ? 'Emails are switched on.' : emailState.key ? 'The Resend key is set. Add the address below to switch emails on.' : 'Not switched on yet: the Resend key has not been added to the site.'}</p>
          <div class="grid2">
            <div class="field"><label for="e-from">Send emails from</label><input id="e-from" type="email" maxlength="120" value="${esc(email.fromAddress)}" placeholder="orders@glossygemzbyzee.com">
              <p class="field__hint">Must end in @glossygemzbyzee.com. It doesn't need a real inbox.</p></div>
            <div class="field"><label for="e-name">Sender name</label><input id="e-name" maxlength="60" value="${esc(email.fromName)}"></div>
            <div class="field"><label for="e-reply">Replies go to</label><input id="e-reply" type="email" maxlength="120" value="${esc(email.replyTo)}" placeholder="glossygemzbyzee@gmail.com">
              <p class="field__hint">When a customer replies to an order email, it arrives here.</p></div>
          </div>
        </section>
        <section class="panel"><h2>Store policies</h2>
          <p class="field__hint">Shown on the store's Delivery, payment and returns page.</p>
          <div class="field"><label for="p-delivery">Delivery details <span class="optional">(optional)</span></label><textarea id="p-delivery" rows="3" maxlength="1500" placeholder="How long delivery takes, which riders you use">${esc(policies.delivery)}</textarea></div>
          <div class="field"><label for="p-returns">Returns and exchanges <span class="optional">(optional)</span></label><textarea id="p-returns" rows="3" maxlength="1500" placeholder="Whether you accept returns, and within how many days">${esc(policies.returns)}</textarea></div>
        </section>
        <div class="savebar"><span></span><button class="btn btn--primary" type="submit">Save settings</button></div>
      </form>
      <form data-password novalidate>
        <section class="panel"><h2>Change password</h2>
          <div class="grid2">
            <div class="field"><label for="pw-now">Current password</label><input id="pw-now" type="password" autocomplete="current-password"></div>
            <div class="field"><label for="pw-new">New password</label><input id="pw-new" type="password" autocomplete="new-password"><p class="field__hint">At least 10 characters.</p></div>
          </div>
          <div class="actions"><button class="btn btn--ghost btn--small" type="submit">Change password</button></div>
        </section>
      </form>`;
    const number = id => $(id).value === '' ? null : Number($(id).value);
    const form = $('[data-settings]');
    form.addEventListener('input', () => { state.dirty = true; });
    form.addEventListener('submit', event => {
      event.preventDefault();
      busy($('button[type="submit"]', form), 'Saving…', async () => {
        await api('settings', { method: 'POST', body: { settings: {
          sale: { enabled: $('#sale-on').checked, name: $('#sale-name').value, start: fromLagos($('#sale-start').value), end: fromLagos($('#sale-end').value), percent: number('#sale-percent') ?? 0, giftOver: number('#sale-gift') ?? 0 },
          delivery: { lagos: number('#fee-lagos'), other: number('#fee-other') },
          bank: { bankName: $('#bank-name').value, accountName: $('#bank-holder').value, accountNumber: $('#bank-number').value },
          contact: { whatsapp: $('#c-wa').value, tiktok: $('#c-tt').value, snapchat: $('#c-sc').value },
          policies: { delivery: $('#p-delivery').value, returns: $('#p-returns').value },
          email: { fromAddress: $('#e-from').value, fromName: $('#e-name').value, replyTo: $('#e-reply').value }
        } } });
        state.dirty = false;
        settingsView(view).then(() => say('Settings saved. The store updates right away.'));
      });
    });
    const passwords = $('[data-password]');
    passwords.addEventListener('submit', event => {
      event.preventDefault();
      busy($('button', passwords), 'Saving…', async () => {
        await api('password', { method: 'POST', body: { current: $('#pw-now').value, next: $('#pw-new').value } });
        passwords.reset();
        say('Password changed.');
      });
    });
  }

  /* ---------- start ---------- */
  function start() {
    shell();
    lastHash = '';
    route();
    loadOrders().catch(() => {});
  }

  api('session', { gate: true }).then(session => {
    if (!session.signedIn) return gate(session.setupNeeded);
    state.email = session.email;
    start();
  }).catch(error => {
    app.innerHTML = `<div class="empty empty--page"><h1>The dashboard could not load.</h1><p>${esc(error.message)}</p><button class="btn btn--primary" type="button" id="retry">Try again</button></div>`;
    $('#retry').addEventListener('click', () => location.reload());
  });
})();
