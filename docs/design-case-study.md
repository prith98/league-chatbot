# Every stat, read against its role

A design case study for **Rift Analyst** — an AI agent that scouts League of Legends
players. The agent, the Riot API client and the role baselines already worked. This
was a rebuild of the interface, the design system and the way the data is presented.

> Published version, with screenshots and a live demo of the core component:
> <https://claude.ai/code/artifact/b489f4ae-cd7c-4cd1-b31b-312f0e4101a6>

---

## What I inherited

The previous build committed to a League-client pastiche: hextech gold hairlines, a
Roman display serif, a spinning emblem watermark, glows on everything. It had a point
of view. Underneath it were problems that atmosphere doesn't fix — most of them only
visible once you measure.

| Area | Finding |
| --- | --- |
| Legibility | 73 hard-coded one-off font sizes across 8 arbitrary values. The smallest, `0.5rem`, renders at **8px**. Deviation figures, sample counts and chart legends lived at 8–10px under heavy uppercase letter-spacing. |
| Contrast | The muted text token was `#5B5A56` on `#010A13` — **2.9:1** against a 4.5:1 requirement. Six of 25 text elements on the landing page failed WCAG AA; the worst measured 2.3:1. |
| Keyboard | `focus:outline-none` on every input with nothing put back. Three hand-rolled modal overlays with no focus trap, no Escape, no `role="dialog"`, no focus restore. |
| Motion | A 24-second infinite rotation, a pulsing bloom, a ping and a scanning bar, with `prefers-reduced-motion` unhandled anywhere. |
| Layout | One 768px column at every breakpoint. On a 1440px screen, two thirds of the display held a rotating watermark while a seven-metric comparison was squeezed into three columns. |
| Scroll | `scrollIntoView` on every render — scroll up to read while the next report streams in and the page yanks you back down. |
| Meaning | The comparison card painted the higher raw number green, telling supports they were "losing" on CS to ADCs. A category error rendered as a verdict. |

An automated audit of the old landing page reported **zero** violations. The patterned
background defeated the contrast checker, which marked 23 elements "undecidable" and
moved on. The failures above came from measuring every text node's computed colour
against its composited background directly. Passing the robot is not the same as
being readable.

---

## The idea

Every stat in this product is role-dependent. 1.3 CS a minute is an ordinary game for
a support and a catastrophe for a mid-laner. The old interface printed the bare number
and left the reader to supply the context they opened the app to get.

So the redesign starts from one rule: **no figure appears without its baseline.**

That rule produced the product's signature component — a track with a tick at its
centre, where the centre is that player's own role average and the bar grows from it
in the direction of the result. It lives in
[`src/components/viz/Meter.tsx`](../src/components/viz/Meter.tsx), appears in every
report in three sizes, and is also the page divider (`.rule` in
[`globals.css`](../src/app/globals.css)): a hairline with a tick at its centre. The
structure of the interface states the product's thesis.

Direction carries the sign, so the reading survives greyscale, colour-blindness and
forced-colors mode. Colour only repeats what the geometry already says.

---

## Decisions

### Colour — hue is a data channel, so the interface doesn't get any

The old build spent gold and teal on chrome, which left the data competing with its own
container and made a green number and a green button look equally important.

The new system is strictly achromatic above the data layer. Surfaces, borders, text,
buttons and focus rings are all neutral; emphasis is carried by value and weight — a
selected filter inverts to paper-on-ink rather than turning a colour. Every saturated
pixel on screen belongs to a reading.

A second rule makes it enforceable: data colours all sit inside a narrow lightness band
(OKLCH L 0.48–0.67) and chrome never does, so a data colour and an affordance can never
be confused because they never occupy the same value.

**Cost:** a monochrome shell is austere and gives up the recognition a signature colour
buys. The identity has to come from type and structure instead.

### Charting — the palette decided how many players fit in one chart

The teammate view overlaid up to five filled polygons on one radar. Running the
candidate series colours through a colour-vision validator (rather than eyeballing them)
was blunt: with five hues in play, violet and azure sit at ΔE 2.9 for a deuteranope.
Only the first three slots clear the all-pairs floor.

So the chart changed to fit the constraint. Two or three players overlay; four or five
become small multiples — one plot each, compared by silhouette across a shared grid. It
reads better on a phone as a side effect. The constraint and its consequence are
documented at the top of [`src/lib/viz.ts`](../src/lib/viz.ts).

**Cost:** small multiples make it harder to watch two specific players cross on one
axis. Every chart has a table view, which covers that case exactly.

### Meaning — nobody wins the comparison

Head-to-head used to crown the larger number in green. Now each player is measured
against *their own* role average, so both bars grow from one shared centre and a
support's 1.1 CS/min sits where it belongs rather than losing to an ADC's 8.4. Where the
two players play different roles, the card says so and tells you to read the bars, not
the figures.

The win-rate row surfaces a piece of statistics the old card had and buried: if the gap
between two players is inside one standard error for the smaller sample, the card prints
"read it as a tie" instead of a winner.

**Cost:** people want a verdict, and this refuses to give a false one.

### Meaning — one row where colour and direction disagree

Deaths are the only metric where lower is better, so the raw change and the verdict
point opposite ways. A green "▲ +33%" under a label reading *Deaths* is nonsense. The
row now reads `▼ 21%` in green: the arrow follows the raw figure, the colour and the bar
follow whether it's good.

**Cost:** one special case in an otherwise uniform component. It earns its keep — this
is the row people misread.

### Information architecture — separate what the agent did from what it found

The agent runs up to twelve tool calls per answer, and each one used to render as a
full, equal-weight card, so a single question produced a wall of panels with the report
buried inside it.

Lookups now collapse into a quiet run log — one line each, expandable, with a result
summary. Only the four analyses render as reports. Process stays visible, because an
agent that shows its work is more trustworthy than one that doesn't; it just stops
competing with the answer. (`isReport` in
[`src/components/tools/types.ts`](../src/components/tools/types.ts) is the whole
mechanism.)

### Layout — two panes on desktop, one thumb-reachable column on a phone

The four analyses were three unlabelled emoji pills wedged above the input. They're the
product's actual capabilities, so they became a permanent left rail on desktop with
names and one-line descriptions, and on mobile they moved behind a sheet reachable from
a button beside the composer, where the thumb already is.

The conversation column holds two measures at once: reports get the full 800px, prose is
held to about 66 characters. A table of eight metrics wants width; a paragraph does not.

The transcript stopped being a chat. A question renders as a heading with a `YOU ASKED`
eyebrow and the answer flows beneath it, so a long session reads like a stack of reports
and scans by question — and the empty right-hand gutter speech bubbles leave on a wide
screen disappears.

**Cost:** losing the bubble convention costs a little familiarity. Scanning a twelve-turn
scouting session is worth more.

### Interaction — let the platform own the modal

The three hand-rolled overlays became one component built on the native `<dialog>`
element. `showModal()` supplies the focus trap, Escape to dismiss, an inert background
and focus returned to the trigger — none of which the old overlays had, and all of which
are easy to get subtly wrong by hand.

Responsive by form rather than scale: a centred dialog from 640px up, a bottom sheet
below it, because a vertically-centred form fights the on-screen keyboard.

Verified under automation: focus starts inside the dialog, stays inside after fourteen
Tab presses, and Escape closes it.

### Interaction — scroll that follows you instead of dragging you

Auto-scroll only engages when you're already within 140px of the bottom. Step away to
read and the view holds still; a "Jump to latest" pill appears, and only while it would
actually do something. The composer became a textarea with Enter to send and
Shift+Enter for a newline, stated in the hint rather than assumed.

### Type — three faces, one job each, one scale

Bricolage Grotesque carries the voice and is used sparingly. Instrument Sans is
everything a person reads as language. IBM Plex Mono is everything a person reads as a
measurement — and that split does the most work: numbers are monospaced with tabular
figures everywhere, so a value is recognisable as measured before it is read, and
columns line up without any layout code.

Seven named steps replaced 73 ad-hoc sizes. The floor is 11px, and only the mono
uppercase labels live there.

---

## Evidence

Both builds were run headless and audited the same way: axe-core against WCAG 2.1 AA,
plus a probe that walks every text node, composites its computed colour over its actual
background and checks the contrast itself.

**Landing page, 1440 × 900**

| Measure | Before | After |
| --- | --- | --- |
| Text elements below WCAG AA | 6 of 25 · 24% | **0 of 39** |
| Worst text contrast | 2.26:1 | **5.32:1** |
| Smallest rendered text | 9.6px | **11px** |
| Ad-hoc font sizes in source | 73 uses · 8 values | **0** |
| Named type-scale steps | — | **7** |
| Contrast checks the tool couldn't decide | 23 | **0** |

**Redesigned build, all states**

| Surface | Text elements | Below AA | axe AA violations |
| --- | --- | --- | --- |
| Landing · desktop | 39 | 0 | 0 |
| Landing · mobile | — | 0 | 0 |
| All four reports + states | 428 | 0 | 0 |
| Draft-planner dialog | — | 0 | 0 |
| Analysis picker · mobile | — | 0 | 0 |

Reports are exercised through `/preview`, a development-only fixture route that renders
every card — loading, error, empty window, five-way overlay, a deliberately over-long
summoner name — so layout can be checked at every breakpoint without spending Riot API
rate limit on each pass. No figure on that route comes from a real account, and the
route 404s in production.

---

## Where the system lives

| File | What it holds |
| --- | --- |
| [`src/app/globals.css`](../src/app/globals.css) | Tokens, type scale, the baseline rule, motion, dialog base |
| [`src/lib/viz.ts`](../src/lib/viz.ts) | Series palette, the three-series overlay ceiling, displacement maths |
| [`src/components/viz/Meter.tsx`](../src/components/viz/Meter.tsx) | The baseline meter, in three sizes |
| [`src/components/viz/StatRadar.tsx`](../src/components/viz/StatRadar.tsx) | Radar, small multiples, table twin |
| [`src/components/ui/`](../src/components/ui) | Dialog, segmented control, fields, icon set |
| [`src/components/tools/`](../src/components/tools) | Run log vs report split, the four report renderers |

Two rules to know before editing:

1. **Don't introduce a coloured button, border or accent.** Emphasis in the chrome is
   value and weight, never hue.
2. **Series colours are a fixed slot order, never cycled**, and at most three may share
   one plot. Four or more is small multiples.

---

## Honest limits

The role baselines are hand-tuned constants pooled across every rank — no public
endpoint exposes them. They are the load-bearing assumption under every meter on screen,
and a Diamond player measured against an all-ranks average is being flattered. Deriving
them per-tier from sampled match data is the highest-value change left.

The product is dark-only. That's a deliberate fit to when and where it gets used, and
the system is token-driven so a light theme is a palette exercise rather than a rewrite
— but it would need its own validated series steps, not an inversion of these.

Conversations don't survive a refresh and reports can't be shared or exported. For a
tool whose output is a scouting document, a permalink is the obvious missing verb.
