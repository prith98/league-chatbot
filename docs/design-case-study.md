# Every stat, read against its role

A design case study for **Rift Analyst**. It pulls live ranked data out of the Riot
API and turns it into scouting reports: player profiles, head-to-head comparisons,
draft plans, squad rankings. A lot of numbers on screen at once.

I shipped a version I was happy with, came back to it a few weeks later, and the data
was fine but the interface was doing almost nothing for it. This is the rebuild, built
around one idea I kept circling back to: a number doesn't mean anything until you know
which role produced it.

The agent, the Riot API client and the role baselines already worked and weren't
touched.

> Published version, with screenshots and a live demo of the core component:
> <https://claude.ai/code/artifact/b489f4ae-cd7c-4cd1-b31b-312f0e4101a6>

## The short version

1. **Color is for data, so the interface doesn't get any.** The chrome is entirely
   gray. Every saturated pixel on screen belongs to a reading.
2. **The palette decided how many players fit in one chart.** A color-vision check said
   only three series can safely share a plot, so four or more became small multiples
   instead of an unreadable pile of overlapping shapes.
3. **Nobody wins the comparison.** The old card painted the bigger number green, which
   told supports they were losing at a job they weren't doing. Now everyone is measured
   against their own role.

| | |
| --- | --- |
| WCAG AA failures across 467 text elements | **0** |
| Worst text contrast | 2.3:1 → **5.3:1** |
| One-off font sizes in source | 73 → **0** (7 named steps) |
| Smallest text on screen | 9.6px → **11px** |

---

## Reviewing my own work

The build I was replacing was mine, from about six weeks earlier. I'd gone all in on
making it look like the League client: gold hairlines, a Roman serif, an emblem rotating
slowly behind everything, a glow on most of it. I liked it. Honestly I still sort of do.

Then I measured it, and a lot of what I'd been calling atmosphere turned out to be in
the way. So I ran the audit I'd run on someone else's work: every text node's computed
color composited over whatever was actually behind it, every rendered font size
collected, every control driven from the keyboard.

| Area | What I found |
| --- | --- |
| Legibility | 73 hard-coded one-off font sizes across 8 arbitrary values. The smallest, `0.5rem`, comes out at **8px**. Things people needed to read were sitting at 8–10px with heavy uppercase letter-spacing on top. |
| Contrast | My muted text token was `#5B5A56` on `#010A13`. That's **2.9:1** against a 4.5:1 requirement. Six of 25 text elements on the landing page failed WCAG AA, worst case 2.3:1. |
| Keyboard | `focus:outline-none` on every input with nothing put back. Three hand-rolled modals with no focus trap, no Escape, no `role="dialog"`, no focus restore. You could tab straight into the invisible page behind an open dialog. |
| Motion | A 24-second infinite rotation, a pulsing bloom, a ping and a scanning bar, with `prefers-reduced-motion` not handled anywhere. |
| Layout | One 768px column at every breakpoint. On a 1440px screen, two thirds of the display was rotating watermark while a seven-metric table got squeezed into three columns next to it. |
| Scroll | `scrollIntoView` on every render. Scroll up to read something while the next report streams in and the page drags you back down. |
| Meaning | The comparison card painted the higher raw number green, so it told supports they were "losing" on farm to ADCs. A category error, sitting in the most prominent view in the product. |

The part that actually surprised me: axe-core reported zero violations on the old
landing page. The patterned background meant it couldn't figure out what was behind the
text, so it marked 23 elements "undecidable" and moved on. Everything above came from
measuring by hand instead. Left to the automated check, I'd have shipped it believing it
passed.

---

## The idea

Almost every stat in this game depends on the role. 1.3 creep score a minute is a
completely normal game for a support and a disaster for a mid-laner. The old version
printed the number and left you to know which one you were looking at, which is the
exact thing you opened the app to find out.

So the rebuild starts from a rule: **no number appears without its baseline.**

That produced the component the whole product runs on: a track with a tick in the
middle, where the tick is that player's own role average and the bar grows out from it.
It lives in [`src/components/viz/Meter.tsx`](../src/components/viz/Meter.tsx), appears in
every report at three sizes, and is also the page divider (`.rule` in
[`globals.css`](../src/app/globals.css)). The direction of the bar already tells you the
sign, so the color is only repeating what the shape says. It still reads in grayscale.

---

## The three decisions that set up everything else

### Color is for data, so the interface doesn't get any

The old version spent gold and teal on furniture: buttons, borders, headings, dividers.
So the data was competing with its own container for attention, and a green number and a
green button read as equally important. They aren't.

Now everything above the data layer is gray. Emphasis comes from value and weight
instead, so a selected filter flips to light-on-dark rather than turning a color. There's
a second rule that makes it hold up: all the data colors sit inside a narrow lightness
band and nothing in the chrome does, so even if I later add something blue by accident it
can't be mistaken for a series.

**Cost:** a gray shell is austere and gives up the recognition you get from a signature
color. All the personality has to come from type and structure, which is harder.

### The palette decided how many players fit in one chart

The teammate view stacked up to five filled shapes on one radar. I ran the candidate
colors through a color-vision check instead of eyeballing them, mostly expecting to
confirm they were fine. They weren't. With five hues on screen, violet and azure come out
at ΔE 2.9 for a deuteranope, close enough to be the same color. Only the first three
slots hold up when every pair has to be distinguishable.

So I changed the chart to fit the constraint rather than shipping past it. Two or three
players overlay; four or five become small multiples. The constraint and its consequence
are written at the top of [`src/lib/viz.ts`](../src/lib/viz.ts).

**Cost:** small multiples make it harder to see exactly where two players cross on one
axis. Every chart has a table view, which handles that.

### Nobody wins the comparison

Head-to-head used to paint the bigger number green. That's fine if both players are ADCs
and nonsense otherwise. Now each player is measured against their own role's average, so
both bars grow from the same center line and a support's 1.1 CS/min sits where it belongs
instead of losing to an ADC's 8.4.

The win-rate row surfaces something the old card already calculated and then buried: if
the gap is inside one standard error for the smaller sample, it prints "read it as a tie"
instead of picking someone.

**Cost:** people want a verdict and this won't give a fake one.

---

## Six smaller calls

- **Split the process from the result.** The agent makes up to twelve tool calls per
  answer and each was a full card, so one question produced a wall of panels with the
  report buried in it. Lookups now collapse into a quiet log, one line each. Only the
  four analyses get to be reports (`isReport` in
  [`src/components/tools/types.ts`](../src/components/tools/types.ts)).
- **One row where the color and the arrow disagree.** Deaths are the only metric where
  less is better, so a green "▲ +33%" under a label saying *Deaths* is gibberish. It now
  shows `▼ 21%` in green: the arrow follows the raw number, the color and bar follow
  whether it's good.
- **Two widths in one column.** Reports get the full 800px, prose is held to about 66
  characters.
- **The transcript stopped being a chat.** Your question renders as a heading with a
  `YOU ASKED` label and the answer runs underneath, so a long session scans by question.
- **Let the browser own the modal.** Three hand-rolled overlays became one component on
  the native `<dialog>` element, so focus trap, Escape, inert background and focus
  restore come from the platform. Checked under automation: focus still trapped after
  fourteen tabs, Escape closes.
- **Scroll follows you instead of dragging you.** Auto-scroll only kicks in if you're
  already near the bottom, with a "jump to latest" button that only appears when it would
  do something.

---

## The phone is not a narrower desktop

Three places where the mobile version is a different layout rather than the same one
shrunk. The **four analyses** are a left rail on desktop; on a 390px screen 240px of
navigation isn't navigation, so they move behind a sheet opened from a button next to the
composer, where your thumb already is. **Dialogs** center from 640px up and become bottom
sheets below that, because a vertically centered form fights the keyboard. And in the
**comparison rows**, the meter drops onto its own full-width line instead of getting
squeezed into 40px, where a ±20% reading would be four pixels long and read as nothing.

---

## Evidence

I ran both builds headless and audited them the same way: axe-core against WCAG 2.1 AA,
plus a probe that walks every text node, composites its computed color over whatever is
actually behind it, and works out the contrast itself.

**Landing page, 1440 × 900**

| Measure | Before | After |
| --- | --- | --- |
| Text elements below WCAG AA | 6 of 25 · 24% | **0 of 39** |
| Worst text contrast | 2.26:1 | **5.32:1** |
| Smallest rendered text | 9.6px | **11px** |
| One-off font sizes in source | 73 uses · 8 values | **0** |
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

The reports get exercised through `/preview`, a dev-only route that renders every card
from fake data: loading, error, empty window, five-way overlay, a deliberately stupid-long
summoner name. It means I can check layout at every breakpoint without burning Riot API
rate limit on each pass. Nothing there comes from a real account, and it 404s in
production.

---

## What the tooling actually changed

I built this in one session with Claude Code, and it's worth being straight about what
that did and didn't do.

The obvious answer is that it went faster, which is true and not very interesting. The
more useful answer is that it made the checking cheap. Standing the old version back up
in a worktree to get honest before-numbers. Writing a probe that walks every text node
and works out its real contrast. Running the palette through color-vision simulation.
Rendering every card at every breakpoint. Each of those is an hour I'd normally decide I
didn't have, and I'd have gone with my gut instead. My gut, per the audit, was wrong
about the contrast.

What it doesn't do is have opinions. It will produce a five-series radar without
blinking. It won't tell you that two of those series are the same color to a chunk of
your users, or that ranking a support below an ADC on farm is a category error rather
than a result. Knowing what to check, and recognizing a wrong answer when it renders, is
still the job.

---

## Where the system lives

| File | What it holds |
| --- | --- |
| [`src/app/globals.css`](../src/app/globals.css) | Tokens, type scale, the baseline rule, motion, dialog base |
| [`src/lib/viz.ts`](../src/lib/viz.ts) | Series palette, the three-series ceiling, displacement math |
| [`src/components/viz/Meter.tsx`](../src/components/viz/Meter.tsx) | The baseline meter, three sizes |
| [`src/components/viz/StatRadar.tsx`](../src/components/viz/StatRadar.tsx) | Radar, small multiples, table twin |
| [`src/components/ui/`](../src/components/ui) | Dialog, segmented control, fields, icon set |
| [`src/components/tools/`](../src/components/tools) | Run log vs report split, the four report renderers |

Two rules before editing:

1. **No colored buttons, borders or accents.** Emphasis in the chrome is value and
   weight, never hue.
2. **Series colors are a fixed slot order, never recycled**, and at most three share one
   plot. Four or more is small multiples.

The product is niche but the underlying problem isn't. Anything that ranks or compares
things measured in different units has to answer "compared to what?", and it either
answers that on screen or quietly leaves you to do it in your head. What came out of this
is three pieces: a value, a baseline, and the distance between them. That part travels.

---

## Honest limits

There's no usage data behind any of this. I built it for the group I play with, and the
whole role-fairness thing came out of us arguing about who was actually carrying. That's
five people who already agree with me, not research. First thing I'd want on a team is to
sit with someone who isn't me while they read a report and hear what they think it says.

The role baselines are hand-tuned constants pooled across every rank, because no public
endpoint exposes them. They're holding up every meter on screen, and a Diamond player
measured against an all-ranks average is being flattered. Deriving them per-tier from
sampled match data is the biggest thing left.

The product is dark-only, which is a deliberate fit to when people use it. The system is
all tokens, so a light theme is a palette exercise rather than a rewrite, but it would
need its own validated series colors rather than an inversion of these.

Conversations don't survive a refresh and you can't share or export a report, which is a
strange gap for a tool whose whole output is a scouting document. A permalink is the
obvious missing thing.
