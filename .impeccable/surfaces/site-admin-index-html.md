---
version: 1
slug: "site-admin-index-html"
primary_target: "site/admin/index.html"
related_targets: ["site/admin/admin.css","site/admin/admin.js"]
---

# Owner dashboard (/admin/)

Scope: `site/admin/`. Mode: Operate. One user: Zee, the owner, often on her phone, between customers.

Job: see new orders and act on them (paid, shipped, delivered, cancel), keep products and stock right, and change the sale, delivery fees, bank details and policy text without help.

Constraints: inherits the storefront's world (same tokens, buttons and fields from `/css/style.css`) but quieter: a pale ground, a plum side rail, gold only on the current section. No new visual identity. Sign-in is one owner account created with a one-time setup code.

Decisions: status is always a labelled pill, never colour alone. Destructive actions (cancel order, delete product) ask once, inline, and say what happens. Order references are set in the text face so every character reads. On a phone the rail becomes four bottom tabs (Orders, Products, Settings, Store) and Sign out lives in Settings.

Unresolved: staff accounts, order alerts, exporting orders.
