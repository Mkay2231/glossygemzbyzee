---
version: 1
slug: "site-index-html"
primary_target: "site/index.html"
related_targets: ["site/shop.html","site/product.html","site/gift.html","site/checkout.html","site/help.html","site/404.html"]
---

# Storefront (home, shop, product, gift builder, checkout, help, 404)

Scope: the public store in `site/`. Mode: Persuade on home; Operate on shop, product, gift builder, bag, checkout and help.

Audience and job: shoppers buying everyday gold jewelry for themselves or as gifts, mostly on a phone; find a piece or set, add to bag, place an order and pay by bank transfer, confirming on WhatsApp.

Constraints: the owner pinned the direction (follow the first GlossyGemzByZee site, improved; colours from her logo and flyer; inspos are structure references only). Checkout places a real order through Netlify Functions; payment is bank transfer. Only two source photos exist (model portrait, five product shots), and the logo is a photographed mock-up, not a clean file.

Unresolved: card payments, automatic order alerts, real product photos and descriptions, a clean high-resolution logo, self-hosted fonts.

## Direction contract

THESIS: A glossy magazine in Zee's own colours: the logo's gold ring frames the people and the groupings (hero portrait, categories, sets, the editorial split, the gift list). Single product shots stay full squares so no part of a piece is cropped. Refuses the cream-and-beige minimal luxury store.

OWN-WORLD: Satin plum and orchid fields (#2c0a31, #690365, #ae0093) owning whole regions on home; flyer pink (#fdadee) for the combos band and set tiles; blush (#fdeeff) for page heads, summaries and strips; paper (#fffaff) as the working ground of the commerce pages, where warm-toned product photos and forms need a quiet field. Logo gold (#f1c729, #f5cc7e) for ring lines, dust, the primary action on dark, and small labels on dark fields (sale bar, footer). Charcoal (#2a3135) footer from the logo ground. Bodoni Moda display with italic emphasis, Jost for everything else, including order references and account numbers. Controls are pills.

STORY: The visitor sees whose store this is and that a sale is days away, browses by category, trusts the clear naira prices and WhatsApp line, and adds a piece, a set or a gift to the bag.

FIRST VIEWPORT: Slim plum sale bar with live countdown. Header with logo badge and wordmark. Full-width satin plum hero: headline "Jewelry worth dressing up for." left at display scale with two actions beneath; right, the model portrait in a large gold ring with slow-orbiting gold dust, a small ringed product photo overlapping, and a gold sale seal.

FORM: User-pinned direction (the first site plus logo colours). It supersedes the dealt roll, whose seed key b782f48f was printed by concept-seed in the build session and is recorded in `.impeccable/direction-round.json`. Signature interaction: the ring, with gold dust orbiting the hero portrait. Motion grammar: slow orbit, exponential ease-out drawer and hover lifts, count badge bump on add.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
