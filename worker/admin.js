const $ = id => document.getElementById(id);
const form = $('product');
const fields = form.elements;
const newProduct = () => ({id:crypto.randomUUID(),revision:0,name:'',type:'Earrings',price:0,stock:0,photos:[],published:false});
let current;
let listings = [];
const pool = [];
let busy = false;
let dirty = false;

async function api(path, options) {
  const response = await fetch('/api/admin/' + path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
function button(label, callback) {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.addEventListener('click', callback);
  return element;
}
function image(id, alt) {
  const element = document.createElement('img');
  element.src = '/media/' + id;
  element.alt = alt;
  element.loading = 'lazy';
  return element;
}
function renderList() {
  $('list').replaceChildren(...listings.map(product => {
    const row = document.createElement('div');
    row.className = 'listing';
    const label = document.createElement('span');
    label.textContent = (product.name || 'Untitled product') + ' · ' +
      (product.published ? (product.stock ? 'Published' : 'Sold out') : 'Draft');
    row.append(label, button('Edit', () => { if (!busy && canSwitch()) edit(product); }));
    return row;
  }));
  if (!listings.length) $('list').textContent = 'No listings yet.';
}
function canSwitch() {
  return !dirty || confirm('Discard unsaved changes to this listing?');
}
function edit(product) {
  current = {...product,photos:[...product.photos]};
  $('editor').hidden = false;
  $('editor-title').textContent = product.revision ? 'Edit product' : 'Add product';
  fields.title.value = current.name;
  fields.type.value = current.type;
  fields.price.value = current.price || '';
  fields.stock.value = current.stock;
  dirty = false;
  renderGallery();
  $('editor').scrollIntoView({block:'start'});
  fields.title.focus({preventScroll:true});
}
function renderGallery() {
  $('gallery').replaceChildren(...current.photos.map((id,index) => {
    const tile = document.createElement('div');
    tile.append(image(id,'Product photo ' + (index + 1)));
    if (index === 0) tile.append('Cover photo');
    else tile.append(button('Make cover', () => {
      if (busy) return;
      current.photos.splice(index,1);
      current.photos.unshift(id);
      dirty = true;
      renderGallery();
    }));
    tile.append(button('Remove', () => {
      if (busy) return;
      current.photos.splice(index,1);
      dirty = true;
      renderGallery();
    }));
    return tile;
  }));
}
function renderPool() {
  $('pool').replaceChildren(...pool.map(photo => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = photo.selected;
    input.addEventListener('change', () => { photo.selected = input.checked; });
    label.append(image(photo.id,''),input,photo.name);
    return label;
  }));
}
async function run(task) {
  if (busy) return;
  busy = true;
  const controls = [...document.querySelectorAll('input,select,button')];
  controls.forEach(control => { control.disabled = true; });
  try { await task(); }
  catch (error) { $('message').textContent = error.message; }
  finally {
    busy = false;
    controls.forEach(control => { control.disabled = false; });
  }
}
async function uploadFiles(input, limit, onPhoto) {
  const files = [...input.files];
  input.value = '';
  if (!files.length) return;
  if (files.length > limit) throw new Error('Select up to ' + limit + ' photos for this upload.');
  const failures = [];
  for (const [index,file] of files.entries()) {
    $('message').textContent = 'Uploading ' + (index+1) + ' of ' + files.length + '…';
    try {
      const {id} = await api('photos',{method:'POST',body:file});
      onPhoto({id,name:file.name,selected:false});
    } catch {
      failures.push(file.name);
    }
  }
  $('message').textContent = failures.length
    ? 'Could not upload: ' + failures.join(', ') + '. Try JPEG, PNG or WebP under 6 MB.'
    : 'Photos uploaded.';
}
async function save(product) {
  const saved = await api('products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(product)});
  listings = [saved,...listings.filter(item => item.id !== saved.id)];
  renderList();
  return saved;
}
$('new').addEventListener('click', () => { if (canSwitch()) edit(newProduct()); });
$('bulk').addEventListener('change', () => run(async () => {
  await uploadFiles($('bulk'),100,photo => pool.push(photo));
  renderPool();
}));
$('group').addEventListener('click', () => {
  if (!canSwitch()) return;
  run(async () => {
    const selected = pool.filter(photo => photo.selected);
    if (!selected.length || selected.length > 12) throw new Error('Select 1 to 12 photos for one draft.');
    const saved = await save({...newProduct(),photos:selected.map(photo => photo.id)});
    for (let index = pool.length - 1; index >= 0; index--) {
      if (pool[index].selected) pool.splice(index,1);
    }
    renderPool();
    edit(saved);
    $('message').textContent = 'Draft created. Add product details and publish when ready.';
  });
});
$('photos').addEventListener('change', () => run(async () => {
  await uploadFiles($('photos'),12-current.photos.length,photo => {
    current.photos.push(photo.id);
    dirty = true;
  });
  renderGallery();
}));
form.addEventListener('input', () => { dirty = true; });
form.addEventListener('submit', event => {
  event.preventDefault();
  const published = event.submitter?.value === 'publish';
  run(async () => {
    current = await save({...current,name:fields.title.value,type:fields.type.value,
      price:Number(fields.price.value),stock:Number(fields.stock.value),published});
    dirty = false;
    $('editor-title').textContent = 'Edit product';
    $('message').textContent = published ? 'Product published to the storefront.' : 'Draft saved.';
  });
});
window.addEventListener('beforeunload', event => {
  if (dirty || pool.length) event.preventDefault();
});
run(async () => {
  listings = await api('products');
  renderList();
});
