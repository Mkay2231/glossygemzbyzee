# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML, CSS and vanilla JavaScript in `site/`, no build step. Hosted on Netlify (owner's choice after Supabase's free project limit was reached). Data lives in Netlify Blobs; Netlify Functions in `netlify/functions/` serve the catalogue, take orders, serve photos and run the owner dashboard. The dashboard is at `/admin/`.

The owner's first store lives in `../glossygemzbyzee` (GitHub: Mkay2231/glossygemzbyzee). This rebuild replaces it and does not use its Worker backend.

## Users

Shoppers buying everyday gold jewelry (earrings, necklaces, bracelets, rings, ready-made sets) for themselves or as gifts. Prices are in the tens of thousands of naira, so purchases are quick-to-moderate decisions; layering, matching sets and gifting are common reasons to buy. Many browse on a phone.

## Product Purpose

The online store for Glossy Gems by Zee: browse the collection, see each piece clearly, put together combos or a gift, add to bag and place an order. Success is a shopper finding pieces they love and completing an order, and the owner handling it from her dashboard.

## Positioning

A personal jewelry brand ("by Zee"), not a faceless catalogue. Anything beyond that (sourcing, materials certification, origin story) is undecided and must not be invented.

## Operating Context

- Prices in Nigerian naira (NGN, ₦).
- Categories in the existing store: Earrings, Necklaces, Bracelets, Rings, Combos.
- Gifting is a core reason to buy: the existing store has a Gift Builder (pick pieces + a gift note).

## Capabilities and Constraints

- Store pages: home, shop with filters and search, product detail, Gift Builder, bag, checkout, help (delivery, payment, returns, ring sizes), 404.
- Payment is by bank transfer, confirmed on WhatsApp (owner's choice). No card payments yet.
- Orders are priced on the server from the saved catalogue; stock is lowered when an order is placed and restored when it is cancelled.
- Dashboard: orders (status, notes, WhatsApp link), products (photos, stock, publish, combos), settings (sale, delivery fees, bank details, contact, policy text). One owner login created with a one-time setup code.
- The catalogue starts with sample products from the first site; delivery fees, bank details and policy text are empty until the owner fills them in.
- No automatic order alerts (email or SMS) exist.

## Brand Commitments

- Name: Glossy Gems by Zee, as written on the logo and flyer. The owner's handle and repo use "GlossyGemzbyZee".
- Tagline from the flyer: "a collection of grace and sophistication". Also from the flyer: "We deliver nationwide".
- Visual direction: follow the first website's direction (elegant serif display with italic accent, editorial photography) and make it better. Explicitly chosen by the owner over new directions.
- Brand colours come from the owner's logo and flyer: magenta and deep purple, orchid pink, gold, charcoal.
- Inspiration images the owner sends are references only; never reuse their shots, text, logos or brand elements.

## Evidence on Hand

- `brand/`: the logo (a photographed mock-up on charcoal, not a clean file) and the anniversary sale flyer (2nd Anniversary Ember Sales, 20 to 30 Nov 2026, 20% off all orders, free gift over ₦10,000; WhatsApp 0907 274 7685; TikTok glossygems.by.zee; Snapchat zhannie_xoxo).
- From the first site: a model portrait and five product shots (512px each), now in `site/assets/img/`.
- Sample products and prices from the first site, seeded into the catalogue and flagged as samples until the owner replaces them.
- No testimonials, press, real delivery fees, bank details or return policy exist yet. The owner enters fees, bank details and policy text in the dashboard. Do not fabricate reviews, customer counts, press mentions or policies.

## Product Principles

1. The pieces are the hero; the interface frames them.
2. Price, category and what's in a set are always easy to see.
3. Gifting is a first-class path, not an afterthought.
4. Trust is earned with honest detail, never invented proof.
5. Every placeholder is obviously replaceable from one place.
