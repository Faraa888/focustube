# UI/UX Pro Max — Design Checklist

## FocusTube Context (Read First)
- Dark theme ONLY — #121212 background, #212121 cards, #333333 borders
- Primary: #e3093a | Productive: #00bb13 | Distracting: #ed2b2b | Neutral: #ffb800
- Components: shadcn/ui | Icons: lucide-react | Font: system stack
- No emojis, no light mode, no glassmorphism
- Stack: React + TypeScript + Vite + Tailwind CSS

---

## Priority Rules (1 = most critical)

| Priority | Category | Key Checks |
|----------|----------|------------|
| 1 | Accessibility | Contrast 4.5:1, alt text, keyboard nav, aria-labels |
| 2 | Touch & Interaction | Min 44×44px targets, loading feedback, hover states |
| 3 | Performance | Lazy loading, skeleton states, no layout shift |
| 4 | Style Consistency | Dark theme only, shadcn/ui components, lucide icons |
| 5 | Layout & Responsive | Mobile-aware, no horizontal scroll, consistent max-width |
| 6 | Typography & Color | System font, semantic color tokens, contrast ratios |
| 7 | Animation | 150–300ms, transform/opacity only, ease-out entries |
| 8 | Forms & Feedback | Visible labels, errors near field, submit feedback |
| 9 | Navigation | Predictable back, consistent placement |
| 10 | Charts & Data | Legends, tooltips, accessible colors (not color alone) |

---

## Accessibility (CRITICAL)

- Minimum 4.5:1 contrast ratio for normal text
- Visible focus rings on all interactive elements
- aria-labels on icon-only buttons
- Tab order matches visual order
- Color is never the only signal — add icon or text
- Form labels always visible, never placeholder-only

---

## Interaction States (CRITICAL)

Every interactive element must have:
- Default
- Hover
- Focus
- Active/pressed
- Disabled (opacity 0.4, no pointer events)
- Loading (spinner or skeleton)
- Error
- Success

---

## FocusTube-Specific Component Rules

### Dashboard
- Data is the hero — minimal chrome around charts
- Stacked bar chart colors: distracting #ed2b2b, neutral #ffb800, productive #00bb13
- Empty state: "Start watching to see your focus patterns here." — never a broken chart
- Loading: skeleton placeholders, not spinners
- Free/expired users: blurred placeholder with yellow upgrade banner — never an error state

### Settings
- Tabs: Goals / Channels / Controls / Plan
- Free users: full-page lock overlay (bg-black/80 backdrop-blur-sm) — not hidden content
- Toggles: shadcn Switch component
- Sliders: 0–120 mins for daily limit, 0 = disabled
- Focus window: 15-min increments, 08:00–22:00 only, max 6 hours

### Overlays (Extension)
- Tier 1 ambient: opacity 0.35 rest, 1.0 hover, 150ms transition
- Tier 2 nudges: rgba(0,0,0,0.85) backdrop blur, centered card, 200ms scale+fade entry
- Tier 3 blocks: solid #121212, no transparency, no blur
- z-index: always 2147483647
- Distracting accent: #e3093a
- Productive accent: #00bb13

### Buttons
- Primary CTA: bg-primary (#e3093a) text-white hover:bg-primary/90
- Secondary: bg-secondary border border-input
- Destructive: bg-destructive
- Ghost: hover:bg-accent only
- Disabled: opacity-40 cursor-not-allowed

### Cards
- Background: bg-card (#212121)
- Border: border-border (#333333)
- Padding: p-6
- Radius: rounded-lg
- Hover (interactive cards): hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10

---

## Typography Scale

| Usage | Classes |
|-------|---------|
| H1 hero | text-5xl md:text-7xl font-bold |
| H2 sections | text-3xl md:text-4xl font-bold |
| Card titles | text-2xl font-semibold |
| Sub-headings | text-xl font-semibold |
| Body | text-xl text-muted-foreground |
| Labels | text-sm font-medium |
| Captions | text-xs text-muted-foreground |
| Brand name | text-2xl font-bold text-primary |

---

## Animation Rules

- Entry: scale(0.96)→scale(1) + opacity 0→1, 200ms ease-out
- Exit: opacity 1→0, 150ms ease-in
- Toast: translateY(20px)→translateY(0), 200ms ease-out
- Never animate width, height, top, left — only transform and opacity
- Respect prefers-reduced-motion

---

## Pre-Delivery Checklist

Run before completing any page or component:

### Visual
- [ ] Dark theme only — no white or light backgrounds
- [ ] No emojis — lucide-react icons only
- [ ] Colors match FocusTube palette above
- [ ] shadcn/ui components used consistently
- [ ] No hardcoded hex values in components — use CSS variables

### Interaction
- [ ] All interactive elements have hover and focus states
- [ ] Loading states exist for all async operations
- [ ] Error states exist and show near the relevant field
- [ ] Disabled states are visually distinct

### Layout
- [ ] No horizontal scroll on any viewport
- [ ] Content doesn't hide behind fixed headers (mt-16 clears 64px header)
- [ ] Max-width consistent: max-w-4xl settings, max-w-6xl dashboard
- [ ] Grid gaps consistent: gap-6 or gap-8

### Accessibility
- [ ] Contrast ratio 4.5:1 minimum for all text
- [ ] Focus rings visible
- [ ] Form labels visible and linked to inputs
- [ ] Icon-only buttons have aria-label

### Data & Charts
- [ ] Empty states defined — never a blank chart or broken state
- [ ] Loading skeletons defined
- [ ] Free/expired users see upgrade prompt — never error state
- [ ] Chart colors are not color-only signals
