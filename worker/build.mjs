import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const files = {'/':'dist/index.html','/style.css':'dist/style.css','/shop.js':'dist/shop.js','/storefront-gifts.js':'dist/shop.js','/hero.jpg':'dist/hero.jpg','/jewelry.jpg':'dist/jewelry.jpg','/admin':'worker/admin.html','/admin.js':'worker/admin.js'};
const assets = Object.fromEntries(Object.entries(files).map(([route,file]) => [route,readFileSync(file).toString('base64')]));
mkdirSync('dist/server',{recursive:true});
writeFileSync('dist/server/index.js','const assets = '+JSON.stringify(assets)+';\n'+readFileSync('worker/index.js','utf8'));
