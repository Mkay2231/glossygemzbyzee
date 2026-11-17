---
name: Glossy Gems by Zee
description: A glossy magazine in Zee's own colours; the logo's gold ring frames people and groupings.
colors:
  plum-950: "#1c0620"
  plum-900: "#2c0a31"
  plum: "#690365"
  orchid: "#ae0093"
  pink: "#fdadee"
  blush: "#fdeeff"
  paper: "#fffaff"
  gold: "#f1c729"
  ring: "#f5cc7e"
  ring-deep: "#b98a1e"
  charcoal: "#2a3135"
  ink: "#2a0f2e"
  muted: "#6d4d72"
  line: "#ecd3ee"
  danger: "#a3123f"
  white: "#ffffff"
  field-line: "#cfaed3"
  ink-soft: "#4a2c4f"
  on-pink: "#4d1f52"
  on-dark-soft: "#f3dcf4"
  plum-glow: "#7d0b78"
  gold-hover: "#ffdf5c"
  admin-ground: "#faf4fb"
typography:
  display:
    fontFamily: "Bodoni Moda, Didot, Bodoni 72, Georgia, serif"
    fontSize: "clamp(3rem, 6.6vw, 5.75rem)"
    fontWeight: 500
    lineHeight: 0.96
    letterSpacing: "-0.02em"
  page-title:
    fontFamily: "Bodoni Moda, Didot, Bodoni 72, Georgia, serif"
    fontSize: "clamp(2.5rem, 5.4vw, 4.25rem)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Bodoni Moda, Didot, Bodoni 72, Georgia, serif"
    fontSize: "clamp(2rem, 4vw, 3.25rem)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Bodoni Moda, Didot, Bodoni 72, Georgia, serif"
    fontSize: "clamp(1.5rem, 2.8vw, 2.25rem)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  note:
    fontFamily: "Bodoni Moda, Didot, Bodoni 72, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.3
  lede:
    fontFamily: "Jost, Century Gothic, Avenir Next, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Jost, Century Gothic, Avenir Next, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
  item-name:
    fontFamily: "Jost, Century Gothic, Avenir Next, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 500
    lineHeight: 1.25
  meta:
    fontFamily: "Jost, Century Gothic, Avenir Next, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.35
  label:
    fontFamily: "Jost, Century Gothic, Avenir Next, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.2em"
  data:
    fontFamily: "Jost, Century Gothic, Avenir Next, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0"
    fontFeature: "tabular-nums"
rounded:
  focus: "4px"
  thumb: "10px"
  field: "12px"
  panel: "16px"
  media: "18px"
  box: "24px"
  pill: "999px"
  circle: "50%"
spacing:
  gutter: "20px"
  container: "1240px"
  control-gap: "10px"
  field-gap: "18px"
  box-pad: "26px"
  header: "76px"
  section-top: "clamp(64px, 8vw, 112px)"
  section-bottom: "clamp(48px, 6vw, 84px)"
components:
  button-primary:
    backgroundColor: "{colors.plum}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "12px 26px"
    height: "50px"
  button-primary-hover:
    backgroundColor: "{colors.orchid}"
  button-gold:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.plum-950}"
    rounded: "{rounded.pill}"
    padding: "12px 26px"
    height: "50px"
  button-gold-hover:
    backgroundColor: "{colors.gold-hover}"
  button-ghost:
    backgroundColor: "transparent"
    rounded: "{rounded.pill}"
    padding: "12px 26px"
    height: "50px"
  button-ghost-hover:
    backgroundColor: "{colors.plum}"
    textColor: "{colors.white}"
  button-small:
    rounded: "{rounded.pill}"
    padding: "8px 18px"
    height: "42px"
  icon-button:
    backgroundColor: "transparent"
    rounded: "{rounded.circle}"
    size: "46px"
  icon-button-hover:
    backgroundColor: "{colors.blush}"
  add-button:
    backgroundColor: "{colors.plum}"
    textColor: "{colors.white}"
    rounded: "{rounded.circle}"
    size: "44px"
  add-button-hover:
    backgroundColor: "{colors.orchid}"
  field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "12px 16px"
  chip:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  chip-selected:
    backgroundColor: "{colors.plum}"
    textColor: "{colors.white}"
  size-chip:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.circle}"
    size: "52px"
  product-card-media:
    backgroundColor: "{colors.blush}"
    rounded: "{rounded.media}"
  summary-box:
    backgroundColor: "{colors.blush}"
    textColor: "{colors.ink}"
    rounded: "{rounded.box}"
    padding: "26px"
  dark-box:
    backgroundColor: "{colors.plum-900}"
    textColor: "{colors.white}"
    rounded: "{rounded.box}"
    padding: "26px"
  admin-panel:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.panel}"
    padding: "clamp(18px, 2.4vw, 26px)"
  admin-nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.on-dark-soft}"
    rounded: "{rounded.field}"
    padding: "12px 14px"
  admin-nav-item-current:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.plum-950}"
  status-pill:
    rounded: "{rounded.pill}"
    padding: "4px 11px"
  toast:
    backgroundColor: "{colors.plum-950}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "13px 22px"
---

# Design System: Glossy Gems by Zee

## Overview

**Creative North Star: "The Gold Ring"**

A glossy magazine in Zee's own colours. The store takes its palette from her logo and flyer (deep plum, orchid, flyer pink, gold, charcoal) and its one recurring figure from the logo too: a thin gold ring with a photograph seated inside it. Satin plum fields own whole regions of the home page; the commerce pages work on a near-white paper so warm product photographs and forms have a quiet ground. Bodoni Moda carries the headlines with an italic turn on the phrase that matters, and Jost carries everything else.

The owner dashboard lives in the same world, turned down: a pale lilac ground, a flat plum side rail, white panels with hairline borders, and gold reserved for the section you are in. It reuses the storefront's buttons, fields, pills and tokens and adds no identity of its own.

The system refuses the cream-and-beige minimal luxury store. Colour is saturated and owned; surfaces are flat; depth is saved for things that float.

**Key Characteristics:**
- Whole bands of colour (satin plum, flyer pink, blush) instead of boxed cards on one ground.
- Gold ring lines framing portraits and groupings; single pieces stay full squares.
- High-contrast Bodoni display with an italic emphasis phrase, set against geometric Jost.
- Pill and circle controls; softly cornered fields and media.
- Flat surfaces separated by hairlines; shadow only on floating layers.
- Slow, settled motion on one exponential ease-out curve.

## Colors

A plum-to-orchid family from the logo, lit by gold, with every neutral tinted toward plum; nothing in the palette is grey or beige except the logo's own charcoal.

### Primary
- **Logo Plum** (plum): the working brand colour on light grounds. Primary buttons, selected chips and size dots, text links, icons in fact lists, the wordmark, selection highlight.
- **Orchid** (orchid): the response and attention colour. Primary button hover, sale prices, discount lines, low-stock notes, count badges, the focus outline on light grounds, and the hot corner of the satin gradient.
- **Satin Plum** (plum-900): the dark field. Hero, gift band, gift box, bank-details box, dashboard rail and sign-in side.
- **Night Plum** (plum-950): the darkest step. Sale bar, toast, text on gold, backdrop tint.

### Secondary
- **Logo Gold** (gold): fills that must win on a dark field: the primary action on dark, the sale seal, hero dust, the current dashboard section, emphasised words in the sale bar.
- **Ring Gold** (ring): the ring line on dark fields, hairline dividers on dark (at 30 to 40% opacity), label text on charcoal and plum.
- **Deep Ring Gold** (ring-deep): the same ring on light grounds: category rings, the current-page underline in the nav, the order-placed mark.

### Tertiary
- **Flyer Pink** (pink): the combos band, set tiles and set product media; the italic emphasis phrase in the hero; gift notes on dark.
- **Charcoal** (charcoal): the footer only, taken from the logo's ground.

### Neutral
- **Paper** (paper): page ground of the storefront, header, bag drawer.
- **Blush** (blush): quiet tinted regions: page heads, promise strip, order summary, drawer footer, media placeholders, hover fill for icon buttons and list rows.
- **Lilac Ground** (admin-ground): the dashboard's page ground, one step deeper than paper so white panels read.
- **White** (white): field and panel fill, text on plum.
- **Ink** (ink): body text, a near-black plum.
- **Soft Ink** (ink-soft): long-form supporting copy (product blurb, help text, confirmation copy).
- **Muted Plum** (muted): secondary text, counts, hints, struck-through prices.
- **Line** (line): hairline dividers and panel borders on light grounds.
- **Field Line** (field-line): the stronger 1px border for inputs, selects, quantity steppers and unselected chips.
- **Soft On-Dark** (on-dark-soft): body copy on plum fields. **On-Pink** (on-pink): body copy on the pink band.
- **Danger** (danger): field errors, the destructive button, low-stock counts in the dashboard.

Status pills in the dashboard use fixed tint pairs outside the brand ramp so each state reads apart: new (#fde4f8 / #8a0075), paid (#fdf0c2 / #5c4300), shipped (#e3effb / #1d4a7a), delivered and live (#e2f4e8 / #1e5a34), cancelled and draft (#eeeaf0 / #5b5560), out of stock (#ffe6ec / #8a1238). Error and confirm blocks sit on #fff0f4 with #7a0c2e text; notices on #fdf0c2 with #4d3800 text.

### Named Rules
**The Owned Field Rule.** Dark and pink are regions, not accents: a section is wholly satin plum, wholly pink, wholly blush or wholly paper, edge to edge. The satin field is plum-900 with an orchid radial bloom from one corner (plus plum-glow from the opposite corner and a faint 118deg pink sheen on the large bands).

**The Gold on Dark Rule.** Full-strength gold fills and gold text appear only on plum or charcoal. On light grounds gold exists only as the deep ring hairline. The single exception in the build is the no-JavaScript notice bar.

**The Paper for Commerce Rule.** Shop, product, gift builder, bag, checkout and help work on paper with blush support. Dark fields there are limited to one contained box (gift box, bank details).

## Typography

**Display Font:** Bodoni Moda (with Didot, Bodoni 72, Georgia)
**Body Font:** Jost (with Century Gothic, Avenir Next, system-ui)

**Character:** A fashion-masthead serif with hairline contrast against a calm geometric sans. The serif is for names and moments; the sans is for everything a shopper or the owner has to read exactly.

### Hierarchy
- **Display** (500, clamp(3rem, 6.6vw, 5.75rem), 0.96, -0.02em): the home hero headline only.
- **Page title** (500, clamp(2.5rem, 5.4vw, 4.25rem), 1.02): h1 on page heads; product, checkout and confirmation titles sit slightly smaller (to 3.75rem or 4rem). Dashboard h1 is clamp(2rem, 4vw, 2.75rem).
- **Headline** (500, clamp(2rem, 4vw, 3.25rem), 1.02, balanced wrap): section h2. Box and drawer headings drop to 1.75 to 2rem.
- **Title** (serif 500, clamp(1.5rem, 2.8vw, 2.25rem), 1.1): set names, category names, the featured card name, form legends (1.5 to 1.625rem), dashboard panel headings (1.375rem).
- **Note** (serif italic 400, 1.0625 to 1.25rem, 1.3 to 1.35): a person's words: gift notes, the footer tagline.
- **Lede** (400, 1.1875rem): the paragraph under a headline, max 28 to 30em.
- **Body** (400, 1.0625rem, 1.55): default text; 1rem at 640px and below and throughout the dashboard. Paragraphs cap at 34 to 38em. Numerals are tabular everywhere.
- **Item name** (sans 500, 1.1875rem, 1.25): product names on cards; weight 500 is also the emphasis weight for prices, totals and field labels.
- **Meta** (400, 0.9375rem): types, counts, hints, breadcrumbs, row sub-lines.
- **Label** (500, 0.8125rem, 0.2em, uppercase): group headings only: footer columns, the shop filter rail, dashboard table heads (0.08em), and the small line under the wordmark.
- **Data** (sans 500, tabular, 0 tracking): order references and account numbers, at whatever size the slot needs (1.375rem summary heading, clamp(1.75rem, 3.4vw, 2.25rem) dashboard order title).

### Named Rules
**The Italic Turn Rule.** A serif headline may turn one phrase to italic at weight 400 ("Jewelry worth *dressing up for.*"). One turn per headline, on the phrase that carries the meaning; on the hero it also takes flyer pink.

**The Data in Sans Rule.** Anything a person will copy or read aloud character by character (order reference, account number, phone, price) is set in Jost with tabular numerals, even where it occupies a heading slot. Bodoni's hairlines are for words.

**The Label Is a Heading Rule.** The uppercase tracked label names a group of links, filters or columns. It is never placed above a headline as a kicker.

## Layout

A centred container of min(100% - 40px, 1240px) on the storefront; full-bleed bands carry their colour to the viewport edge with the container inside. Sections breathe at clamp(64px, 8vw, 112px) above and clamp(48px, 6vw, 84px) below; a section head puts the h2 left and a supporting line or "see all" link right, aligned to the bottom edge.

Composition is two-column and asymmetric where there is a story (1.05fr / 0.95fr hero and product page, 0.9fr / 1.1fr editorial split, 1.1fr / 0.9fr gift band) and a fixed side column where there is a task (240px filter rail; 380px gift box; 420px order summary), with the side column sticky at 100px under the 76px sticky header. Product grids auto-fill at a 230px minimum; the home collection is a four-column grid whose first card spans two columns and two rows. Categories are five rings in a row.

The dashboard is a 232px rail plus a main column capped at 1080px. Lists are bordered row groups with fixed column tracks, detail screens are stacked panels in a 1.5fr / 1fr split, and a sticky save bar holds form actions.

Breakpoints: at 1120px the nav collapses behind a menu button; at 900px every split becomes one column, sticky columns release, the filter list becomes a horizontally scrolling chip row, and the dashboard rail becomes a fixed bottom tab bar; at 640px grids go to two columns, search moves into the open menu, and categories reflow three-then-two. Controls stay at 44 to 50px by default; the smallest targets on phones are 36 to 40px (quantity steppers, card add and save).

## Elevation & Depth

Flat. Regions are separated by a change of field colour or a 1px hairline (line on light, ring gold at 30 to 40% on dark), never by a card shadow. Product cards, panels, summaries and rows carry no shadow at rest or on hover; hover is expressed by image scale, a small lift of the ring, or a fill change.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 18px 40px -22px rgb(44 10 49 / 0.45)`): the toast and the opened mobile menu.
- **Drawer** (`box-shadow: -30px 0 60px -30px rgb(28 6 32 / 0.55)`): the bag drawer, over a plum-950 backdrop at 50%.
- **Seal** (`box-shadow: 0 14px 30px -12px rgb(0 0 0 / 0.6)`): the gold sale seal sitting over the hero portrait.
- **Save bar** (`box-shadow: 0 -10px 30px -18px rgb(44 10 49 / 0.35)`): the dashboard's sticky save bar.
- **Field focus** (`box-shadow: 0 0 0 3px rgb(174 0 147 / 0.18)`): a soft orchid halo with a plum border on focused inputs.

### Named Rules
**The Only Floats Cast Rule.** A shadow means the element is detached from the page and sits above it (drawer, toast, menu, seal, sticky bar). Shadows are large, soft and pulled in with negative spread. Nothing in the page flow casts one.

## Shapes

Two families. Controls are fully round: pill buttons, chips, search, quantity steppers and toasts (999px), and circular icon buttons, add and save buttons, size dots and badges (50%). Containers are softly cornered: 12px for fields, alerts, thumbnails and nav items, 16px for dashboard panels and row groups, 18px for product media, 24px for the larger boxes (summary, gift box, product hero image).

The signature form is the ring: a circle photograph inside a 1.5px gold line with a padded gap between line and image (9px by default, 14px and a 2px line on the hero, 3 to 7px on small rings). Rings overlap one another and their neighbours (a small ring tucked into the corner of a portrait or photo; two or three rings clustered on a pink tile to show a set). One arch appears once: the editorial photo with a fully rounded top and 18px bottom corners.

Borders are 1px hairlines, 1.5px on the ring, ghost button and nav underline. Icons are inline 24-unit SVG line drawings at 1.5 stroke with round caps and joins, coloured by currentColor.

### Named Rules
**The Ring Rule.** The gold ring frames people and groupings: the portrait, a category, the members of a set, an editorial accent, the items gathered in a gift. The image a shopper buys from (product card, product page, gift option, bag line) is always a full square with soft corners, so no part of a piece is cropped.

## Components

### Buttons
Calm, weighty pills; colour does the work, not effects.
- **Shape:** full pill (999px), 50px minimum height, 12px 26px padding, Jost 500 at 1rem, a 1.5px border slot that is transparent unless ghost. A small variant (42px, 8px 18px, 0.9375rem) serves dashboard rows and panels.
- **Primary:** plum fill, white text; hover turns orchid.
- **Gold:** gold fill, night-plum text, hover lightens; the primary action on dark fields only.
- **Ghost:** currentColor outline on transparent; hover fills plum with white text, or fills white with plum text on dark.
- **Danger (dashboard):** danger outline and text; hover fills danger. Destructive actions confirm once, inline, in a pale red block.
- **States:** press scales to 0.98; disabled is a pale lilac fill with muted text; transitions 0.25s on the shared ease-out.
- **Text link:** plum, 1px underline offset 4px, orchid on hover. The "see all" link is plum 500 with a bottom rule and an arrow that slides 5px on hover.
- **Icon buttons:** 46px transparent circles that fill blush on hover, with an orchid count badge that bumps when the count changes. The card add button is a 44px plum circle; the save button a 44px translucent paper circle whose heart fills orchid when pressed.

### Chips
- **Filter chips (dashboard, mobile shop):** white pill with field-line border, 8 to 10px by 14px; selected is plum fill with white text; counts sit inside at 70% opacity.
- **Filter list (desktop shop):** borderless 12px-radius rows with the count right-aligned; blush on hover, plum when selected.
- **Size dots:** 52px white circles with a field-line border; selected fills plum.
- **Status pills:** 4px 11px, 0.875rem at weight 500, tint pair per state. Always a word, never colour alone.

### Cards / Containers
- **Product card:** no container. A square image (18px corners, blush behind) over type, name and a foot row with price left and the round add button right. Hover scales the image to 1.05 over 0.8s; the whole card is the link. Sold out desaturates the image. Sets show a ring cluster on a pink tile instead of a photo.
- **Summary box:** blush, 24px corners, 26px padding, sticky beside the form; totals as a definition list with a ruled total row.
- **Dark box:** satin plum, 24px corners, white text, ring-gold hairlines between rows (gift box, bank details).
- **Dashboard panel and row group:** white, 1px line border, 16px corners, no shadow. Rows are hairline-separated with a pale uppercase header row and a blush hover.

### Inputs / Fields
- **Style:** white fill, 1px field-line border, 12px corners, 12px 16px padding; label above in Jost 500; hint below in muted meta.
- **Focus:** border turns plum with the 3px orchid halo. Everything else takes the global focus outline: 2px orchid offset 3px, gold on dark fields.
- **Error:** danger border and a danger message beneath the field.
- **Search:** a white pill with a hairline border and a round plum-icon submit.
- **Quantity:** a white pill holding two round plum-icon buttons and the number.
- **Native controls:** checkboxes and range use plum as accent colour. The dashboard switch is a 48 by 28px pill, grey-lilac off and plum on.
- **Picture options (gift builder):** a square photo that takes a 2px plum outline, offset 3px, and a round tick when chosen.

### Navigation
- **Storefront:** sticky paper header with a hairline beneath; ringed logo badge and the italic serif wordmark in plum with a spaced uppercase line below; Jost links at 1rem that turn orchid on hover; the current page is plum 500 with a 1.5px deep-ring underline. Below 1120px the links become a full-width ruled list under the header.
- **Sale bar:** a slim night-plum strip above the header with gold emphasis and a live countdown.
- **Footer:** charcoal, four columns, ring-gold uppercase column labels, the tagline in italic serif.
- **Dashboard rail:** flat satin plum, 232px; items are 12px-radius rows with a line icon; hover is a white 8% veil; the current section is a gold fill with night-plum text; new orders show in an orchid badge. On phones it becomes bottom tabs with icon over label.

### The Ring
The signature component: `padding` gap, 1.5px gold line, circular image. Ring gold on dark, deep ring gold or plum on light and pink. On the hero the large ring is circled by gold dust (scattered dots in an SVG) that orbits once every 140s, and a gold seal tilted 9deg straightens on hover. Category rings lift 6px and turn orchid on hover.

### Bag Drawer and Toast
The bag is a right-hand native dialog, 460px wide and full height, sliding in over 0.5s with a head, a scrolling list of 72px-thumb lines and a blush footer holding totals and actions. Confirmations arrive as a night-plum pill toast rising from the bottom centre.

### Motion
One curve for everything: `cubic-bezier(0.16, 1, 0.3, 1)`. Controls respond in 0.2 to 0.25s; images and rings move over 0.5 to 0.8s; entrances settle from 94% scale over 1.1s with short staggers; loading cards breathe at 1.6s. Reduced-motion preferences switch all of it off.

## Do's and Don'ts

### Do:
- **Do** give each section one field colour edge to edge, and change field to change subject.
- **Do** put people and groupings in gold rings, and overlap a small ring onto its neighbour.
- **Do** keep the image a shopper buys from a full square with 18px corners.
- **Do** use the gold button for the main action on a dark field and the plum button on a light one.
- **Do** make controls pills or circles and give fields 12px corners.
- **Do** separate with hairlines and field changes; keep shadows for the drawer, toast, menu, seal and sticky bar.
- **Do** set order references, account numbers and prices in Jost with tabular numerals.
- **Do** say status in words inside a tinted pill.
- **Do** turn one phrase of a serif headline to italic 400.
- **Do** build dashboard screens from the storefront's own buttons, fields and tokens on the lilac ground.

### Don't:
- **Don't** drift toward cream or beige neutrals; every working neutral here is tinted plum.
- **Don't** put full-strength gold fills or gold text on paper, blush or pink; use the deep ring hairline there.
- **Don't** crop a product's own card or detail image into a circle.
- **Don't** wrap product cards in a bordered or shadowed box.
- **Don't** set body copy, labels, prices or references in Bodoni Moda.
- **Don't** place the uppercase tracked label above a headline as a kicker; it names groups of links, filters and columns only.
- **Don't** use the satin gradient for the dashboard's working area; it belongs to the storefront bands and the sign-in side.
- **Don't** show order or stock state by colour alone.
- **Don't** add a second easing curve or bouncy motion.
