# Design language — "Overview Dashboard" reference

Source: dashboard reference image supplied by the user (fintech overview: KPI row, bar chart, donut, map, quick stats, risk monitor).
Values below are read by eye from the image, so treat hex codes and pixel sizes as approximate and tune against the real app.

**One-line summary:** a calm, airy, *light* UI — a big white rounded shell on a grey canvas, soft grey cards, fully-round pill controls, black as the primary action colour, and a single coral accent used for data.

---

## 1. Overall composition

- **Canvas:** flat mid-grey page background (≈ `#BDBDBD`) with the whole app floating on it as one large white "shell".
- **Shell:** white, very large corner radius (≈ 48px), soft diffuse shadow. Content sits inside with ~40px outer padding.
- **Three zones:** top bar (logo · centred tabs · utilities), a slim **vertical icon rail** on the left, and the main content area.
- **Density:** generous whitespace. Cards are separated by ~20px gaps; nothing is cramped.

## 2. Colour

| Role | Approx. value | Notes |
|---|---|---|
| Canvas | `#BDBDBD` | page behind the shell |
| Shell / surface | `#FFFFFF` | |
| Card fill | `#F7F7F7` – `#F9F9F9` | almost white, with a 1px border `#EEEEEE` |
| Chip / inactive pill fill | `#F1F1F1` – `#F3F3F3` | tabs, icon buttons, secondary buttons |
| **Primary / ink** | `#0B0B0B` | active tab, active rail icon, primary button, icon chips on KPI cards |
| Text primary | `#111111` | titles, values |
| Text secondary | `#6B6B6B` | labels, table text |
| Text muted | `#9A9A9A` | axis labels, "last month", subtitles |
| **Accent (coral)** | `#E2634B` | the only brand colour — chart bars, donut lead segment, map highlights |
| Positive | `#16A34A` | up-trend triangle + percentage |
| Negative | `#E5484D` | down-trend triangle + percentage, "High" risk |
| Warning | `#D97706` | "Medium" risk |

Chart palette is **coral + neutrals**, not a rainbow: coral `#E2634B` → black `#0B0B0B` → charcoal `#333` → mid grey `#808080` → light grey `#B3B3B3`.
Semantic status colours (green / amber / red) appear only as small tinted badges and trend arrows.

## 3. Typography

- **Family:** clean neo-grotesque / geometric sans (Inter, Geist or similar). One family throughout.
- **Page title:** ≈ 40px, *regular* weight, near-black. Subtitle underneath ≈ 22px, muted grey, may carry an emoji (👋).
- **Card title:** ≈ 20px, **semibold/bold**.
- **KPI value:** ≈ 40px, **bold**, tight tracking.
- **KPI label:** ≈ 18px, *medium*.
- **Body / table text:** ≈ 16px, regular, secondary grey. Table **headers are bold + near-black**.
- **Axis / helper text:** ≈ 16–18px, muted grey.
- Weight does the hierarchy work; there's very little colour in text.

## 4. Shape & elevation

- **Radius scale:** shell ≈ 48px · cards ≈ 24px · inner chips ≈ 12–16px · **pills and icon buttons = fully round (999px)**.
- **Borders:** hairline `#EEE` on cards; outlined (`1px #E0E0E0`, white fill) on dropdown pills.
- **Shadows:** almost none on cards (flat). Soft shadow only on the shell, the primary black button, and floating tooltips.

## 5. Components

**Top navigation**
- Logo (black geometric mark) far left.
- Centred **pill tab group**: active tab = solid black pill, white text; inactive tabs = light-grey pills, dark text. No underline indicators.
- Right: circular light-grey icon buttons (search, notifications with a small red dot) + circular avatar.

**Left icon rail**
- Vertical stack of ≈ 52px circular buttons. Active = black circle with white filled icon; inactive = light-grey circle with thin outline icon.

**Page header**
- Circular back button, big title + greeting.
- Right-aligned action pills: two **secondary** (light grey, icon + label: "Last 7 Days", "Export") and one **primary** (black, white text, soft shadow: "Share Report").

**KPI card** (5 across, equal width)
- Top row: small black circular icon chip (≈ 28px) · label · "···" overflow menu at the right.
- Big bold value, then trend: tiny filled triangle (green ▲ / red ▼) + coloured percentage + muted "last month".

**Chart card**
- Title (bold) top-left; **outlined dropdown pill** top-right ("This Year ⌄", "This Month ⌄").

**Bar chart**
- Rounded-top bars with a **vertical gradient**: coral at the top fading to near-transparent at the base.
- The highlighted bar is a deeper, more solid coral.
- Dashed light-grey horizontal gridlines; muted y-labels (8M…1M) and x-labels (Jan…Dec); no axis lines.
- **Tooltip:** white rounded card with soft shadow — icon chip, label, "···", bold value, green delta.

**Donut chart**
- Thick ring (≈ 25–30% of diameter), segments separated by tiny gaps, colours per chart palette above.
- Centre: small muted caption ("Top Category") over a bold two-word value.
- **Legend table** beside it: coloured dot + method, percentage, volume; bold column headers.

**Data tables inside cards** (Geographic, Quick Stats, Risk monitor)
- No row borders or zebra — just aligned columns with generous row height (≈ 46px).
- Secondary "View details →" / "View All" / "Live" text link top-right in muted grey.
- **Risk badges:** small circular shield icons on a *tinted* circle (green / amber / red) next to the level name.

**Map**
- World map in light grey with highlighted regions in coral.

**Icons:** thin outline line icons (≈ 1.5px stroke, rounded caps); filled only when "active" (rail) or inside the black KPI chips.

## 6. Layout grid

- KPI row: **5 equal columns**.
- Chart row: **≈ 55 / 45** (bar chart wider than donut).
- Bottom row: **≈ 45 / 25 / 28** (geo / quick stats / risk).
- Consistent ~20px gutters; cards in a row share the same height.

## 7. Interaction & tone

- Hover/active states are subtle: grey → slightly darker grey; black stays black.
- Tone is quiet and confident: neutral palette, one accent, numbers are the heroes.

---

## Applying this to the ITP Workflow app (notes for a restyle)

The app is currently **dark slate** (`bg-slate-950/900/800`, purple/blue accents). Adopting this language means moving to a light theme:

- **Shell & surfaces:** white shell on grey canvas; replace `slate-9xx` backgrounds with card-grey `#F7F7F7` + `#EEE` borders.
- **Admin header tabs** (Members · Projects · BMS · Workflow): switch to the black-active / light-grey-inactive **pill group**; drop the per-tab colour coding.
- **Primary buttons** (Save, Create Task, Initiate…): black pills; secondary actions light-grey pills; destructive actions keep red but as tinted pills.
- **Accent:** use coral `#E2634B` instead of purple/blue — e.g. progress bars, active workflow step, selected list item marker.
- **Status colours:** keep green / amber / red but as small tinted badges (matches the risk badges). Map to workflow states: done = green, current = coral or black, awaiting PM = amber.
- **Task list / checklist cards:** rounded-24 grey cards, bold titles, muted metadata, trend-style small indicators.
- **Possible new dashboard** (the reference itself): KPI row for the Tasks home — tasks in progress, awaiting PM action, checklists completed, overdue — with the "icon chip + big number + delta vs last month" card; a bar chart of completions per month; a donut of tasks by workflow stage.
- **Workflow diagram** (React Flow): light canvas, white nodes with 1px borders and round-ish corners, black pill Start/End, coral for the current step.
- **Icons:** replace emoji glyphs (☰ ◆ ☑ ■) in workflow nodes with thin outline line icons (lucide-react is already a dependency).
