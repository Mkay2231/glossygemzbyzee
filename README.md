# Glossy Gems by Zee

The online store and owner dashboard for Glossy Gems by Zee. Everything runs on Netlify: the site is static files, the data lives in Netlify Blobs, and four small functions handle products, orders, photos and the dashboard login.

## What is where

| Path | What it is |
|---|---|
| `site/` | The public store. Plain HTML, CSS and JavaScript, no build step. |
| `site/admin/` | The owner dashboard, at `/admin/` on the live site. |
| `netlify/functions/store.mts` | `GET /api/store`: published products and public settings. |
| `netlify/functions/orders.mts` | `POST /api/orders`: places an order. Prices, stock and discounts are worked out on the server. |
| `netlify/functions/media.mts` | `GET /media/:id`: serves uploaded product photos. |
| `netlify/functions/admin.mts` | `/api/admin/*`: everything the dashboard does. Needs a signed-in owner. |
| `netlify/functions/blog.mts` | `/api/blog`: published blog posts for the store. |
| `netlify/functions/track.mts` | `/api/track`: a customer's view of their own order, by private link or by order number plus phone. |
| `netlify/lib/mail.mts` | The paid, shipped and delivered emails, sent through Resend. |
| `netlify/lib/lgas.mts`, `site/js/lgas.js` | The 774 local government areas by state. Keep the two copies identical. |
| `netlify/lib/` | Shared code: data access (`store.mts`) and the owner login (`auth.mts`). |
| `netlify.toml` | Publish folder, functions folder and security headers. |
| `brand/`, `inspo/`, `PRODUCT.md` | Source material and the product brief. Not published. |

## Run it on your computer

```bash
npm install
```

```bash
npm run dev
```

Then open `http://localhost:8888`. The dashboard is at `http://localhost:8888/admin/`.

Local data is a sandbox on your computer. It never touches the live store.

The first time you open the local dashboard it asks for a setup code. For local use, that code is the `ADMIN_SETUP_CODE` line in the `.env` file in this folder. `.env` is never uploaded.

## Put it online

1. Create the Netlify site and link this folder to it (`npx netlify init` or `npx netlify link`).
2. Set a secret environment variable on the site called `ADMIN_SETUP_CODE`. Make it long and random (at least 12 characters). This is the one-time code Zee uses to create her login.
3. Deploy: `npm run deploy:preview` for a preview address, then `npm run deploy` for the live site.
4. Zee opens `/admin/`, enters the setup code, her email and a password of her choice. The code stops working once it has been used.

Environment variables are frozen into each deploy. After changing one, deploy again.

### Switch on customer emails (Resend)

Customers get an email when Zee marks their order paid, shipped or delivered. Until this is set up, orders still work and the order page still updates; only the emails are skipped, and the dashboard says why.

1. Create a free account at resend.com.
2. In Resend, go to Domains, add `glossygemzbyzee.com` and choose a region. Resend lists DNS records (DKIM, SPF and a bounce MX on the `send` subdomain).
3. Add those records at Namecheap (Domain List → glossygemzbyzee.com → Advanced DNS), then press Verify in Resend.
4. In Resend, create an API key with "Sending access" and add it to the site as a secret, from this folder:

   ```bash
   npx netlify env:set RESEND_API_KEY "paste-the-key-here" --secret
   ```

5. Deploy again (`npm run deploy`). Environment variables only take effect on the next deploy.
6. In the dashboard, open Settings → Customer emails, set "Send emails from" to `orders@glossygemzbyzee.com`, check "Replies go to" (glossygemzbyzee@gmail.com by default) and save. The panel says "Emails are switched on" when everything is in place.

The free plan sends up to 100 emails a day and 3,000 a month. If the daily limit is reached, the dashboard marks the email as not sent; use "Send again" the next day (the limit resets at 1am Lagos time).

## Domain

The store is served at `https://www.glossygemzbyzee.com`; `glossygemzbyzee.com` redirects there. DNS is at Namecheap: an ALIAS record on `@` pointing to `apex-loadbalancer.netlify.com` and a CNAME on `www` pointing to `glossy-gems-by-zee.netlify.app`. Netlify issues the HTTPS certificate on its own once those resolve.

For local testing, `EMAIL_OUTBOX=local` in `.env` stores emails in a local outbox instead of sending them.

### If Zee forgets her password

Set `ADMIN_SETUP_CODE` to a new value, deploy, and she uses "Reset it with a new setup code" on the sign-in page. Her products and orders are not affected.

## What Zee manages in the dashboard

- **Orders:** every order placed on the store, with the customer's details, a WhatsApp link, and buttons to mark it paid, shipped or delivered. Cancelling an order puts its pieces back on sale.
- **Products:** add, edit, publish, unpublish and delete products. Photos are shrunk on her phone before uploading. Combos are built from existing pieces and have their own price and stock.
- **Lip Gloss:** a shop category like the jewelry; shades go in the product's Options.
- **Gift items:** flowers, money bouquets and other extras, added with "Add gift item". They appear only in the Gift Builder, never in the shop. For a money bouquet, switch on "Customer chooses how much cash goes in": the price becomes her fee, and the customer types the cash amount (within the smallest and largest she sets) and pays both.
- **Blog:** write, publish and edit posts with an optional cover photo. Blank lines separate paragraphs, "## " starts a subheading and "- " a list item. The blog page and the home page's "From the blog" section appear once the first post is published.
- **Settings:** the sale (dates, discount, free gift threshold), delivery fees, the bank account customers pay into, contact details, and the delivery and returns text shown on the store.

The store starts with seven sample products carried over from the first site. Edit or delete them in the dashboard.

## How an order works

1. The customer checks out. The server checks stock, applies any running sale, adds the delivery fee for their state if one is set, saves the order and lowers the stock.
2. The customer sees the order reference, a link to their order page and, if bank details are set, the account to pay into.
3. The customer sends payment proof to Zee on WhatsApp. That message is how Zee hears about a new order; the dashboard also shows a count of new orders.
4. Zee marks the order paid, then shipped, then delivered. Each step emails the customer (once Resend is set up) and updates their order page.
5. Customers who lose the link find their order at `/order.html` with the order number and their phone number.

## Known limits

- **New order alerts** go by email to the address in Settings → Customer emails (glossygemzbyzee@gmail.com by default). Each alert counts towards Resend's daily limit. There is no SMS alert.
- **No card payments.** Payment is by bank transfer. A provider such as Paystack can be added later.
- **One owner login.** There are no staff accounts.
- **Small-shop storage.** Netlify Blobs suits a catalogue of hundreds of products and a few thousand orders. A much busier store should move orders to a real database.
- **Combos and stock.** Selling a combo lowers the combo's own stock, not the stock of the pieces inside it.
- **Rate limits.** Order and dashboard endpoints ask Netlify to rate-limit by IP. Check the limits are active on the site's plan after the first deploy.

## Policies and compliance

- **Policies:** `site/privacy.html`, `site/terms.html`, `site/refunds.html` and `site/cookies.html`, linked from every page's footer. They are drafts written against the Nigeria Data Protection Act 2023 and the Federal Competition and Consumer Protection Act and should be reviewed by a Nigerian lawyer. Change the "Last updated" date when editing them.
- **Numbers in the policies to confirm:** report faulty or wrong items within 3 days of delivery; reply within 2 working days; refunds within 7 working days; order records kept for up to 6 years.
- **Checkout consent:** an unticked box for the terms, refund policy and the 18+ or parental-permission statement. The server refuses orders without it and records the terms version and time on each order.
- **Data deletion:** on a delivered or cancelled order, the dashboard's "Erase customer details" removes name, phone, email, address and notes, keeps items and amounts, and switches off the order's tracking link.
- **Cookies:** no banner, because the store sets nothing that needs consent. The cookie policy lists everything stored; update it if a new storage key or cookie is added.
- **Third parties:** none load in the browser. Fonts are self-hosted from `site/assets/fonts` (SIL Open Font License, in `OFL.txt`). Netlify (hosting) and Resend (emails) process data on the server, as the privacy policy says.

### Images to replace

These came from the first site and their licence is unknown. Replace them with Zee's own photos and logo:

- `site/assets/img/model.jpg` (home page hero, Combos category, blog fallback, link previews)
- `site/assets/img/sola-hoops.jpg`, `pearl-drop-necklace.jpg`, `dune-cuff.jpg`, `lumi-dome-ring.jpg`, `fine-line-bracelet.jpg` (sample products, the home page and the Gift Builder teaser)
- `site/assets/img/logo-badge.jpg` and `favicon.png` (header, footer, dashboard, browser tab)

Product photos are replaced by uploading new ones in the dashboard; the others are files to swap in this folder.
