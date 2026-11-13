const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json = (data, status=200) => Response.json(data,{status,headers});
const error = (message,status=400) => json({error:message},status);
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/;
const types = ['Earrings','Necklaces','Bracelets','Rings'];
const mime = {'css':'text/css','js':'text/javascript','jpg':'image/jpeg'};
const photoTypes = ['image/jpeg','image/png','image/webp'];

async function save(request, env) {
  const {id, revision, name, type, price, stock, photos, published} = await request.json();
  if (!uuid.test(id) || !Number.isSafeInteger(revision) || revision < 0 ||
      typeof name !== 'string' || name.length > 120 || !types.includes(type) ||
      !Number.isSafeInteger(price) || price < 0 || price > 999999999 ||
      !Number.isSafeInteger(stock) || stock < 0 || stock > 999999 ||
      !Array.isArray(photos) || photos.length > 12 || new Set(photos).size !== photos.length ||
      photos.some(photo => !uuid.test(photo)) || typeof published !== 'boolean') {
    return error('Check the product details.');
  }
  if (published && (!name.trim() || !price || !photos.length)) return error('Add a name, price and photo before publishing.');
  const missing = await Promise.all(photos.map(photo => env.BUCKET.head(photo)));
  if (missing.some(photo => !photo)) return error('A photo is missing. Upload it again.');
  const product = {name:name.trim(), type, price, stock, photos, published};
  const data = JSON.stringify(product);
  const query = revision
    ? env.DB.prepare('UPDATE products SET data=?, published=?, revision=revision+1 WHERE id=? AND revision=?').bind(data,+published,id,revision)
    : env.DB.prepare('INSERT INTO products VALUES (?,?,?,1) ON CONFLICT(id) DO NOTHING').bind(id,data,+published);
  const result = await query.run();
  if (!result.meta.changes) return error('This listing changed elsewhere. Reload it before saving.',409);
  return json({...product,id,revision:revision+1});
}

async function upload(request, env) {
  const type = request.headers.get('Content-Type');
  const size = Number(request.headers.get('Content-Length'));
  if (!photoTypes.includes(type) || !size || size > 6*1024*1024) return error('Choose a JPEG, PNG or WebP up to 6 MB.');
  const bytes = new Uint8Array(await request.arrayBuffer());
  const valid = {
    'image/jpeg': bytes[0]===255 && bytes[1]===216 && bytes[2]===255,
    'image/png': bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71,
    'image/webp': String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP'
  };
  if (bytes.length !== size || !valid[type]) return error('The selected file is not a supported image.');
  const id = crypto.randomUUID();
  await env.BUCKET.put(id,bytes,{httpMetadata:{contentType:type}});
  return json({id},201);
}

export default {
  async fetch(request,env) {
    const url = new URL(request.url);
    const path = url.pathname === '/admin/' ? '/admin' : url.pathname;
    const identity = request.headers.get('oai-authenticated-user-id');
    const email = request.headers.get('oai-authenticated-user-email')?.toLowerCase();
    const admin = Boolean(identity && email && email === env.CATALOG_ADMIN_EMAIL?.trim().toLowerCase());
    const read = request.method === 'GET';
    try {
      const protectedRoute = path === '/admin' || path === '/admin.js' || path.startsWith('/api/admin/');
      if (protectedRoute && !admin) {
        if (!identity && path === '/admin') return Response.redirect(new URL('/signin-with-chatgpt?returnTo=%2Fadmin',url));
        return error('Sign in with the catalog manager account.',403);
      }
      if (protectedRoute && !read && request.headers.get('Origin') !== url.origin) return error('Invalid request origin.',403);
      if (request.method === 'POST' && path === '/api/admin/products') return await save(request,env);
      if (request.method === 'POST' && path === '/api/admin/photos') return await upload(request,env);
      if (read && ['/api/admin/products','/api/catalog'].includes(path)) {
        const listing = path === '/api/admin/products';
        const {results} = await env.DB.prepare(listing
          ? 'SELECT * FROM products ORDER BY rowid DESC'
          : 'SELECT * FROM products WHERE published=1 ORDER BY rowid DESC').all();
        return json(results.map(row => {
          const {published,...product} = JSON.parse(row.data);
          return listing ? {...product,published,id:row.id,revision:row.revision} : {...product,id:row.id};
        }));
      }
      if (read && path.startsWith('/media/')) {
        const id = path.slice(7);
        if (!uuid.test(id)) return error('Photo not found.',404);
        if (!admin && !await env.DB.prepare("SELECT 1 FROM products, json_each(products.data, '$.photos') WHERE published=1 AND json_each.value=? LIMIT 1").bind(id).first()) return error('Photo not found.',404);
        const photo = await env.BUCKET.get(id);
        if (!photo) return error('Photo not found.',404);
        return new Response(photo.body,{headers:{...headers,'Content-Type':photo.httpMetadata.contentType}});
      }
      if (read && Object.hasOwn(assets,path)) {
        const type = mime[path.split('.').at(-1)] || 'text/html';
        return new Response(Uint8Array.from(atob(assets[path]), char => char.charCodeAt(0)),{headers:{...headers,'Content-Type':type}});
      }
      return error('Page not found.',404);
    } catch (cause) {
      console.error(path,cause.message);
      return error('Could not complete this request. Try again.',500);
    }
  }
};
