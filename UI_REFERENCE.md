# FocusTube UI Reference

Generated from a full audit of `frontend/src/pages`, `frontend/src/components`, `frontend/src/index.css`, and `frontend/tailwind.config.ts`.

---

## DESIGN SYSTEM

### Color Palette

All colors are defined as CSS custom properties in `src/index.css` using HSL values. The app is **dark-theme only** — there is no light mode toggle.

| Token | HSL Value | Approximate Hex | Usage |
|---|---|---|---|
| `--background` | `0 0% 7%` | `#121212` | Page background |
| `--foreground` | `0 0% 100%` | `#ffffff` | Body text |
| `--card` | `0 0% 13%` | `#212121` | Card backgrounds |
| `--card-foreground` | `0 0% 100%` | `#ffffff` | Text on cards |
| `--popover` | `0 0% 13%` | `#212121` | Popover/dropdown backgrounds |
| `--primary` | `348 90% 48%` | `≈ #e3093a` | CTAs, active states, brand accents |
| `--primary-foreground` | `0 0% 100%` | `#ffffff` | Text on primary backgrounds |
| `--secondary` | `0 0% 16%` | `#292929` | Secondary buttons, chips |
| `--secondary-foreground` | `0 0% 100%` | `#ffffff` | Text on secondary backgrounds |
| `--muted` | `0 0% 20%` | `#333333` | Muted backgrounds, disabled areas |
| `--muted-foreground` | `0 0% 70%` | `#b3b3b3` | Subdued/secondary text |
| `--accent` | `0 0% 16%` | `#292929` | Hover backgrounds (same as secondary) |
| `--accent-foreground` | `0 0% 100%` | `#ffffff` | Text on accent |
| `--destructive` | `0 84.2% 60.2%` | `≈ #f56565` | Error states, destructive actions |
| `--destructive-foreground` | `0 0% 100%` | `#ffffff` | Text on destructive |
| `--border` | `0 0% 20%` | `#333333` | All borders |
| `--input` | `0 0% 16%` | `#292929` | Input field backgrounds |
| `--ring` | `348 90% 48%` | `≈ #e3093a` | Focus ring (same as primary) |

**Sidebar-specific tokens** (used in sidebar variant):
- `--sidebar-background`: `0 0% 13%` (same as card)
- `--sidebar-primary`: `348 90% 48%` (same as primary)
- `--sidebar-accent`: `0 0% 16%` (same as accent)
- `--sidebar-border`: `0 0% 20%` (same as border)

**Data visualisation colors** (defined inline in `WatchTimeMap.tsx`):
- Distracting: `#ed2b2b` (bright red)
- Neutral: `#ffb800` (amber)
- Productive: `#00bb13` (green)

**Status colors** (used ad-hoc via Tailwind utilities):
- Success / check marks: `text-green-500` (`#22c55e`)
- Warning: `text-yellow-500` (`#eab308`)
- Error/destructive: `text-red-500` (`#ef4444`)
- Upgrade banner: `bg-yellow-500/10`, `border-yellow-500/30`, `text-yellow-500`

### Typography

No custom font is imported. The app inherits the Tailwind CSS font stack (system-ui / Inter fallback).

| Usage | Classes |
|---|---|
| Page headings (H1) | `text-5xl md:text-7xl font-bold` (Home hero), `text-4xl md:text-5xl font-bold` (Pricing/Download) |
| Section headings (H2) | `text-3xl md:text-4xl font-bold` or `text-3xl md:text-5xl font-bold` |
| Card titles | `text-2xl font-semibold leading-none tracking-tight` (shadcn CardTitle default) |
| Sub-section headings | `text-xl font-semibold`, `text-2xl font-bold` |
| Body text | `text-xl text-muted-foreground`, `text-sm text-muted-foreground` |
| Labels | `text-sm font-medium` (nav links), `text-base` (settings labels) |
| Captions / helper text | `text-xs text-muted-foreground` |
| Brand name | `text-2xl font-bold text-primary` |
| Code / monospace | Not used |

### Spacing Scale

Tailwind defaults are used throughout. Notable patterns:

| Pattern | Value | Usage |
|---|---|---|
| Container padding | `px-4` | Universal container horizontal padding |
| Section vertical padding | `py-20` | Most page sections |
| Hero top padding | `pt-32 pb-20` | Landing hero (clears fixed header) |
| App page top margin | `mt-16` | All pages with Header (clears 64px fixed header) |
| Card padding | `p-6` (header), `p-6 pt-0` (content) | shadcn Card defaults |
| Grid gap | `gap-6`, `gap-8` | Cards and grids |
| Form field spacing | `space-y-4`, `space-y-6` | Form sections |
| List spacing | `space-y-2`, `space-y-3` | Item lists |

### Border Radius

Defined via CSS variable `--radius: 0.5rem`:

| Token | Value | Tailwind class |
|---|---|---|
| `rounded-lg` | `0.5rem` (= `--radius`) | Default for cards, inputs, containers |
| `rounded-md` | `0.375rem` (= `--radius - 2px`) | Buttons default |
| `rounded-sm` | `0.25rem` (= `--radius - 4px`) | Small elements |
| `rounded-full` | `9999px` | Circular badges, avatar-like elements |

### Shadow Styles

| Class | Usage |
|---|---|
| `shadow-sm` | shadcn Card default |
| `shadow-2xl` | Hero image container |
| `hover:shadow-lg hover:shadow-primary/10` | FeatureCard hover state |

### Background Colors / Gradients

No CSS gradients are used. Backgrounds are flat colors with occasional opacity modifiers:

| Pattern | Usage |
|---|---|
| `bg-background` | All page roots |
| `bg-card` | Card component default |
| `bg-card/30` | Section backgrounds on landing (subtle differentiation) |
| `bg-card/50` | Muted section backgrounds |
| `bg-primary/5` | Final CTA section background |
| `bg-primary/10` | Icon containers, info banners |
| `bg-muted/50` | Inline info boxes, list item hover |
| `bg-black/80 backdrop-blur-sm` | Full-page upgrade lock overlay (Settings) |
| `bg-background/95 backdrop-blur-lg` | Fixed header background |

---

## COMPONENT LIBRARY

### UI Library

**shadcn/ui** on top of **Radix UI primitives**. Components live in `src/components/ui/`. The `components.json` config defines the setup.

shadcn/ui components installed (all in `src/components/ui/`):

`accordion` · `alert-dialog` · `alert` · `aspect-ratio` · `avatar` · `badge` · `breadcrumb` · `button` · `calendar` · `card` · `carousel` · `chart` · `checkbox` · `collapsible` · `command` · `context-menu` · `dialog` · `drawer` · `dropdown-menu` · `form` · `hover-card` · `input-otp` · `input` · `label` · `menubar` · `navigation-menu` · `pagination` · `popover` · `progress` · `radio-group` · `resizable` · `scroll-area` · `select` · `separator` · `sheet` · `sidebar` · `skeleton` · `slider` · `sonner` · `table` · `tabs` · `textarea` · `toast` · `toaster` · `toggle-group` · `toggle` · `tooltip`

### Button Variants

Defined in `src/components/ui/button.tsx` via `cva`:

| Variant | Classes | Usage |
|---|---|---|
| `default` | `bg-primary text-primary-foreground hover:bg-primary/90` | Primary CTAs (Start Trial, Save, Submit) |
| `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive/90` | Dangerous actions |
| `outline` | `border border-input bg-background hover:bg-accent hover:text-accent-foreground` | Secondary actions, Free plan CTA, Sign Out |
| `secondary` | `bg-secondary text-secondary-foreground hover:bg-secondary/80` | Less prominent actions |
| `ghost` | `hover:bg-accent hover:text-accent-foreground` | Navbar icon buttons, subtle actions |
| `link` | `text-primary underline-offset-4 hover:underline` | Inline text links (Contact Support) |

**Button sizes:**

| Size | Classes | Usage |
|---|---|---|
| `default` | `h-10 px-4 py-2` | Standard |
| `sm` | `h-9 rounded-md px-3` | Inline actions (Block channel button) |
| `lg` | `h-11 rounded-md px-8` | Hero CTAs, pricing CTAs |
| `icon` | `h-10 w-10` | Mobile menu trigger, ghost icon buttons |

**Common button patterns in use:**
- `className="w-full"` — full-width in forms/cards
- `disabled={loading}` — loading state (text changes to "Saving...", "Creating account...", etc.)
- `asChild` — renders as `<Link>` or `<a>` via Radix Slot

### Input / Form Components

| Component | Usage |
|---|---|
| `Input` | Text, email, password fields; standard `border border-input bg-background` via shadcn default |
| `Label` | Paired with every Input via `htmlFor` |
| `Textarea` | Installed but not actively used in current pages |
| `Switch` | Toggle controls in Settings (block shorts, hide recommendations, focus window) and Goals (auto-block) |
| `Slider` | Daily time limit in Settings (`min=1 max=120 step=1`) |
| `Select` / `SelectTrigger` / `SelectContent` / `SelectItem` | Focus window time pickers in Settings (15-min increments) |
| `Separator` | Horizontal divider on Login/Signup between OAuth and email form |
| `Form` | Installed (shadcn react-hook-form wrapper) but raw `<form>` used in current pages |

**Form layout pattern:**
```
<form className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="field">Label</Label>
    <Input id="field" name="field" type="..." placeholder="..." required />
  </div>
  ...
  <Button type="submit" className="w-full" disabled={loading}>
    {loading ? "Loading state text..." : "Submit text"}
  </Button>
</form>
```

### Card Components

`Card` from shadcn/ui — used universally. Default classes:
- `Card`: `rounded-lg border bg-card text-card-foreground shadow-sm`
- `CardHeader`: `flex flex-col space-y-1.5 p-6`
- `CardTitle`: `text-2xl font-semibold leading-none tracking-tight`
- `CardDescription`: `text-sm text-muted-foreground`
- `CardContent`: `p-6 pt-0`
- `CardFooter`: `flex items-center p-6 pt-0`

**Card variants in use:**

| Variant | How achieved |
|---|---|
| Default card | `<Card>` with no extra classes |
| Highlighted / featured | `className="border-2 border-primary"` (Pro pricing card, "Most Popular") |
| Subtle / muted | `className="bg-card/50"` |
| Error card | `className="border-destructive/50 bg-destructive/5"` |
| Info card | `className="border-primary/50 bg-primary/5"` |
| Warning card | `bg-yellow-500/10 border border-yellow-500/30` (upgrade banner, not a Card component) |

### Modal / Dialog Components

`Sheet` (shadcn) is used for the **mobile navigation drawer**:
- `SheetTrigger` wraps a `Button variant="ghost" size="icon"` showing `<Menu>` icon
- `SheetContent` opens from the right, contains nav links stacked vertically (`flex flex-col gap-4 mt-8`)

`Dialog`, `AlertDialog`, `Drawer` are installed but not actively used in current pages.

`Sonner` (toast) and `Toaster` are both mounted in `App.tsx` at the root level.

### Navigation Components

`Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` used in:
- **Settings** page: 4-tab layout (Goals / Blocked Channels / Controls / Account) — `grid w-full grid-cols-4`
- **Pricing** page: billing period toggle (Monthly / Yearly) — `w-auto` inline tabs

`Accordion` / `AccordionItem` / `AccordionTrigger` / `AccordionContent` used in:
- Home page FAQ section
- Pricing page FAQ section

`Badge` used throughout:
- `variant="secondary"`: trial badge, neutral labels, "Blocked" status
- `variant="default"` (primary): "Most Popular" label, goal tags in Goals page
- `variant="outline"`: channel/distraction tags in Goals page, numbered ranking badges
- `variant="destructive"`: distraction ranking badges, spiral event "Today" badge

---

## PAGE LAYOUTS

### `/` — Home (Landing Page)

**File:** `src/pages/Home.tsx`
**Structure:** `<Header />` + multiple `<section>` blocks + `<Footer />`

| Section | Layout | Key Elements |
|---|---|---|
| Hero | `text-center`, centered container `max-w-6xl` | H1 (`text-5xl md:text-7xl font-bold`), subtitle, two CTAs (`flex flex-col sm:flex-row gap-4 justify-center`), hero image in bordered rounded container |
| Problem Statement | `text-center`, `max-w-4xl` | H2, descriptive paragraph |
| How It Works | `bg-card/30`, `grid md:grid-cols-3 gap-8` | 3 numbered steps, each with circular icon (`w-16 h-16 bg-primary/10 rounded-full`) |
| Features Grid | `grid md:grid-cols-2 lg:grid-cols-3 gap-6` | 8× `<FeatureCard>` components |
| Who It's For | `text-center`, `max-w-4xl` | H2 + paragraph |
| Free vs Pro | `bg-card/30`, `grid md:grid-cols-2 gap-6` | 2 plan cards, Pro card has `border-2 border-primary` + floating `<Badge>` |
| FAQ | `max-w-3xl`, `Accordion` | 5 accordion items |
| Final CTA | `bg-primary/5 border-y border-primary/20`, `text-center` | H2, subtitle, single large CTA button, small disclaimer text |

**CTAs:** "Start Free Trial" (`default`, `size="lg"`) + "Install Extension" (`outline`, `size="lg"`)

---

### `/login` — Login Page

**File:** `src/pages/Login.tsx`
**Structure:** Full-screen centered layout, no Header/Footer

```
min-h-screen bg-background flex items-center justify-center p-4
  └─ Card w-full max-w-md
       ├─ CardHeader
       │    ├─ Brand link (FocusTube)
       │    ├─ CardTitle "Welcome back"
       │    └─ CardDescription "Sign in to access your dashboard"
       └─ CardContent space-y-4
            ├─ Button (outline, full-width) — "Continue with Google" [Chrome icon]
            ├─ Separator with "Or continue with email" label
            └─ <form> space-y-4
                 ├─ Error: text-sm text-red-500 text-center
                 ├─ Email Input
                 ├─ Password Input (with "Forgot?" link top-right)
                 ├─ Submit Button (full-width, default)
                 └─ "Don't have an account? Sign up" link
```

**Loading states:** Google button shows "Loading..." · Submit shows "Signing in..."

---

### `/signup` — Signup Page

**File:** `src/pages/Signup.tsx`
**Structure:** Same full-screen centered layout as Login

```
min-h-screen bg-background flex items-center justify-center p-4
  └─ Card w-full max-w-md
       ├─ CardHeader — CardTitle "Create your account", CardDescription "Start your free trial"
       └─ CardContent
            ├─ [if emailConfirmationSent]: Alert (green border/bg, CheckCircle2 icon, confirm email message)
            └─ [else]:
                 ├─ Google OAuth Button (outline)
                 ├─ Separator "Or continue with email"
                 ├─ Alert (destructive) — error display
                 └─ <form> space-y-4
                      ├─ Full name Input
                      ├─ Email Input
                      ├─ Password Input (placeholder "At least 8 characters")
                      ├─ Submit Button — "Start free trial" / "Creating account..."
                      ├─ Terms/Privacy links (text-xs text-muted-foreground)
                      └─ "Already have an account? Sign in" link
```

---

### `/goals` — Onboarding / Goals Page

**File:** `src/pages/Goals.tsx`
**Structure:** Full-screen centered layout, no Header/Footer

```
min-h-screen bg-background flex items-center justify-center p-4
  └─ Card w-full max-w-2xl
       ├─ CardHeader — "Set Your Focus Goals"
       └─ CardContent
            ├─ [if checkingAuth]: Loading text
            └─ <form> space-y-6
                 ├─ Info banner (bg-primary/10 border border-primary/20, Info icon)
                 ├─ Goals input section
                 │    ├─ Label + helper text (text-xs text-muted-foreground)
                 │    ├─ Input + "Add Goal" Button (flex gap-2)
                 │    └─ Badge list (flex flex-wrap gap-2) — each Badge has X remove button
                 ├─ Pitfalls input section (same pattern, Badge variant="secondary")
                 ├─ Channels input section (same pattern, Badge variant="outline")
                 │    └─ [if channels.length > 0]: Switch + Label for "Block these channels immediately"
                 ├─ Error text (text-sm text-red-500 text-center)
                 └─ Submit Button (full-width, disabled if no goals)
```

**Badge pattern for tags:**
```
Badge + X button inside, hover:bg-primary/80 rounded-full p-0.5
```

---

### `/app/dashboard` — Dashboard

**File:** `src/pages/Dashboard.tsx`
**Structure:** `<Header />` + `<main>` + `<Footer />`

```
min-h-screen bg-background flex flex-col
  ├─ Header (fixed)
  └─ main flex-1 container mx-auto px-4 py-8 mt-16
       ├─ [if showUpgradeBanner]: Warning banner (bg-yellow-500/10, flex justify-between)
       ├─ Page title "Your Stats" (text-3xl font-bold)
       ├─ [if statsError]: Error Card (border-destructive/50 bg-destructive/5)
       ├─ [if !extensionConnected]: Info Card (border-primary/50 bg-primary/5)
       ├─ [if statsLoading]: Loading text (text-center py-12)
       └─ [if stats loaded]:
            ├─ FocusScore (centered, max-w-md, w-full)
            ├─ WatchTimeMap (full width)
            ├─ grid gap-6 md:grid-cols-2
            │    ├─ SpiralFeed
            │    └─ ChannelAudit
            ├─ WeeklySummary (full width)
            ├─ Category Breakdown Card (optional)
            └─ Top Distractions This Week Card (optional, with Block buttons)
```

**Auth loading state:** Full-screen centered `text-muted-foreground` text, no skeleton.

---

### `/app/settings` — Settings

**File:** `src/pages/Settings.tsx`
**Structure:** `<Header />` + `<main>` + `<Footer />`

```
min-h-screen bg-background flex flex-col
  └─ main flex-1 container mx-auto px-4 py-8 mt-16 max-w-4xl relative
       ├─ Page title "Your FocusTube"
       ├─ [if isFreeMode]: Full-page overlay (absolute inset-0 bg-black/80 backdrop-blur-sm z-50)
       │    └─ Centered modal: "Settings Locked" + Upgrade to Pro button
       └─ Tabs (4-col grid, pointer-events:none + opacity:0.5 when locked)
            ├─ Goals Tab
            │    ├─ Card: "Your Goals" — Input + Add button + list items with X
            │    ├─ Card: "Common Distractions" — same pattern
            │    └─ "Save Goals" Button (full-width)
            ├─ Blocked Channels Tab
            │    └─ Card: Input + Add + channel list + "Save & Normalise Channels" Button
            ├─ Controls Tab
            │    ├─ Card: "Content Filters" — Switch rows (block shorts, hide recommendations)
            │    ├─ Card: "Time Limits" — Slider with Badge showing current value
            │    ├─ Card: "Focus Window" — Switch + conditional Select grid (2 columns)
            │    ├─ Card: "Nudge Style" — 3 Buttons acting as radio (default = selected, outline = unselected)
            │    └─ "Save All Controls" Button (full-width)
            └─ Account Tab
                 ├─ Card: "Subscription" — plan display + Upgrade button if free
                 └─ Card: "Sign Out" — outline Button full-width
```

**List item pattern (Goals/Settings):**
```
flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors
```

---

### `/pricing` — Pricing

**File:** `src/pages/Pricing.tsx`
**Structure:** `<Header />` + `<main>` + `<Footer />`

```
main flex-1 container mx-auto px-4 py-20 mt-16 max-w-7xl
  ├─ Page header (text-center): Badge, H1, subtitle
  ├─ Billing toggle: Tabs (monthly/yearly), "Save 17%" Badge on yearly
  ├─ Pricing cards: grid md:grid-cols-2 gap-8 max-w-5xl mx-auto
  │    ├─ Free Card: standard border, $0/forever, feature list, outline CTA
  │    └─ Pro Card: border-2 border-primary, floating "Most Popular" Badge,
  │         price display, feature list, default CTA "Start 30-Day Trial"
  ├─ Trust badges: flex flex-wrap justify-center gap-8 (Shield, Zap, Check icons)
  ├─ FAQ Accordion (max-w-3xl mx-auto)
  └─ Contact CTA: bg-card/50 border rounded-lg p-12 text-center
```

---

### `/download` — Download

**File:** `src/pages/Download.tsx`
**Structure:** `<Header />` + `<main>` + `<Footer />`

```
main flex-1 container mx-auto px-4 py-20 mt-16 max-w-4xl
  ├─ Page header (text-center): Badge, H1, subtitle
  ├─ Install Card (border-primary/50): Chrome icon, CTA button
  ├─ Setup Steps: 3× Card with numbered circles (bg-primary/10 rounded-full)
  ├─ Post-install tips Card (bg-card/50): Check icon list items
  └─ Next steps: flex col/row CTAs + support link
```

---

### `/privacy` and `/terms` — Legal Pages

**Files:** `src/pages/Privacy.tsx`, `src/pages/Terms.tsx`
Not read in full, but structure follows the standard `<Header />` + content + `<Footer />` pattern.

---

### `*` — 404 Not Found

**File:** `src/pages/NotFound.tsx`
Not read in full; standard not-found fallback page.

---

## NAVIGATION STRUCTURE

### Header (`src/components/Header.tsx`)

- **Position:** `fixed top-0 w-full z-50`
- **Background:** `bg-background/95 backdrop-blur-lg border-b border-border`
- **Container:** `container mx-auto px-4 py-4 flex items-center justify-between`
- **Height:** ~64px (cleared by `mt-16` or `pt-32` on page content)

**Left:** Brand link — `<Link to="/">FocusTube</Link>` — `text-2xl font-bold text-primary`

**Center (desktop `md:flex hidden`):** Nav links — `text-sm font-medium text-foreground hover:text-primary transition-colors`

**Auth-conditional nav links:**
- Unauthenticated: Home · Pricing · Download · Login
- Authenticated: Home · Pricing · Download · Dashboard · Settings · `{email}` (text-primary) · Sign Out (ghost Button with LogOut icon)

**Right:**
- Unauthenticated: "Start Free Trial" Button (default, hidden on mobile)
- Mobile: `Sheet` drawer trigger — ghost icon Button with `<Menu h-6 w-6>`

**Mobile menu (Sheet):**
- Opens from right edge
- Nav links at `text-lg font-medium`, stacked `flex flex-col gap-4 mt-8`
- Auth state mirrors desktop
- Sign Out: `variant="outline" mt-4 w-full`
- CTA: `<Button asChild className="mt-4">Start Free Trial</Button>`

### Footer (`src/components/Footer.tsx`)

- **Background:** `border-t border-border bg-card mt-20`
- **Grid:** `grid grid-cols-1 md:grid-cols-4 gap-8`
- **Columns:** Brand blurb · Product links (Download, Pricing) · Legal links (Privacy, Terms) · Support (email)
- **Bottom bar:** `mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground` — copyright

### Sidebar

No sidebar exists in the current codebase. The `sidebar.tsx` shadcn component is installed but not used by any page.

---

## VISUAL PATTERNS & STATES

### Card Styling

Default shadcn Card: `rounded-lg border bg-card shadow-sm`

| Card type | Additional classes |
|---|---|
| Default | none |
| Featured (Pro plan) | `border-2 border-primary relative` |
| Info state | `border-primary/50 bg-primary/5` |
| Error state | `border-destructive/50 bg-destructive/5` |
| Muted/subtle | `bg-card/50` |
| Install CTA | `border-primary/50` |

**FeatureCard** (custom component): `bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10`
- Icon container: `w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4`

### Form Layout

All forms follow the same pattern:
1. Full-width `Card` container (max-w-md for auth, max-w-2xl for onboarding, max-w-4xl for settings)
2. `CardHeader` with title + optional description
3. `CardContent` with `space-y-4` or `space-y-6`
4. Each field: `<div className="space-y-2">` wrapping `Label` + `Input`
5. Full-width submit `Button` at bottom

### Error States

| Context | Pattern |
|---|---|
| Inline form error | `<div className="text-sm text-red-500 text-center">` |
| Alert component error | `<Alert variant="destructive">` with `AlertTitle` + `AlertDescription` |
| Card-level error | Card with `border-destructive/50 bg-destructive/5`, `AlertCircle` icon, description, Retry button |
| Settings validation error | `<p className="text-sm text-destructive">` inline below affected field |
| Focus window error | Same as above |

### Loading States

| Context | Pattern |
|---|---|
| Full page auth check | `min-h-screen flex items-center justify-center` + `text-muted-foreground` text |
| Dashboard data loading | `text-center py-12` + `text-muted-foreground` text |
| Auth loading in header | Links and CTA hidden while `loading === true` |
| Button loading | `disabled={loading}` + text changes: "Signing in...", "Creating account...", "Saving...", "Normalising & Saving..." |
| Goals submission | Two states: "Normalising channel names..." → "Saving..." |

### Empty States

| Component | Pattern |
|---|---|
| SpiralFeed (no data) | `text-sm text-muted-foreground text-center py-8` |
| ChannelAudit (no data) | `text-sm text-muted-foreground text-center py-8` |
| WatchTimeMap (no data) | `h-64 flex items-center justify-center text-muted-foreground` |
| Goals list (empty) | `text-sm text-muted-foreground text-center py-4` |
| Blocked channels (empty) | `text-sm text-muted-foreground text-center py-4` |

### Success Messages

All success feedback via `toast()` (shadcn Toaster + Sonner both mounted):
```ts
toast({ title: "Goals saved", description: "Your goals have been updated." })
toast({ title: "Channel blocked", description: "..." })
toast({ title: "Logged out", description: "..." })
```

On Signup, a green-themed `Alert` is shown inline for email confirmation:
`border-green-500/50 bg-green-50 dark:bg-green-950/20` with `CheckCircle2` icon

### Hover / Active States

| Pattern | Usage |
|---|---|
| `hover:text-primary transition-colors` | All nav links |
| `hover:opacity-80 transition-opacity` | Brand logo link |
| `hover:border-primary/50 hover:shadow-lg` | FeatureCard |
| `hover:bg-muted/50 transition-colors` | Settings list items, Goals list items |
| `hover:bg-primary/90` | Primary button (built into variant) |
| `hover:bg-accent hover:text-accent-foreground` | Outline / ghost buttons (built into variant) |
| `hover:underline` | Footer links, legal links, "Forgot?" link |

### Upgrade / Paywall States

- **Settings (free mode):** Full-page overlay `absolute inset-0 bg-black/80 backdrop-blur-sm z-50` with centered modal. Tabs rendered but `pointer-events: none; opacity: 0.5`.
- **Dashboard upgrade banner:** Yellow banner at top of content area — `bg-yellow-500/10 border border-yellow-500/30`, yellow "Upgrade" button (`bg-yellow-500 hover:bg-yellow-600 text-black`).

---

## RESPONSIVE DESIGN

### Breakpoints

Standard Tailwind breakpoints (no custom breakpoints defined):

| Breakpoint | Width | Usage |
|---|---|---|
| `sm` | `640px` | Button row switches from `flex-col` to `flex-row` (hero CTAs) |
| `md` | `768px` | Header nav visible, footer grid 4-col, feature grids activate, 2-col layouts |
| `lg` | `1024px` | Features grid goes to 3 columns |
| `2xl` (container) | `1400px` | Container max-width cap |

Container: `center: true, padding: "2rem"` (at 2xl).

### Mobile-Specific Patterns

- Header nav hidden (`hidden md:flex`) — replaced by Sheet drawer (`md:hidden`)
- "Start Free Trial" CTA in header hidden on mobile (`hidden md:inline-flex`)
- Hero CTAs: `flex-col sm:flex-row gap-4` (stacked on mobile, inline on sm+)
- Post-install CTAs: `flex flex-col sm:flex-row gap-4`
- Settings tabs: `grid w-full grid-cols-4` — may be tight on small screens (no mobile override)
- Focus window selectors: `grid grid-cols-2 gap-4` (stays 2-col on mobile)

### Desktop-Specific Patterns

- Feature grid: 3 columns (`lg:grid-cols-3`)
- Dashboard grid: 2 columns (`md:grid-cols-2`) for SpiralFeed + ChannelAudit
- Pricing cards: 2 columns (`md:grid-cols-2`)
- Footer: 4 columns (`md:grid-cols-4`)
- Page max-widths: `max-w-4xl` (Download, Settings), `max-w-6xl` (Home hero), `max-w-7xl` (Pricing)
- Settings page: `max-w-4xl` centred with `container mx-auto`

---

## ICON LIBRARY

**lucide-react** is used throughout. Icons in use:

`Shield` `Sparkles` `Clock` `BarChart3` `Zap` `Ban` `Check` `Menu` `LogOut` `Chrome` `Download` `CheckCircle2` `AlertCircle` `AlertTriangle` `X` `Plus` `Info` `Flame` `TrendingUp`

Icon sizing conventions:
- `h-4 w-4` — button icons, small inline
- `h-5 w-5` — feature list checks, form icons
- `h-6 w-6` — card alert icons, nav icons
- `h-12 w-12` — feature card icons
- `h-16 w-16` — Download page Chrome icon

---

## ROUTING

Defined in `src/App.tsx`:

| Path | Component | Auth required |
|---|---|---|
| `/` | `Home` | No |
| `/pricing` | `Pricing` | No |
| `/download` | `Download` | No |
| `/login` | `Login` | No (redirects to dashboard if session found) |
| `/signup` | `Signup` | No |
| `/goals` | `Goals` | Yes (redirects to /login if no session) |
| `/app/dashboard` | `Dashboard` | Yes (`useRequireAuth` hook) |
| `/app/settings` | `Settings` | Yes (`useRequireAuth` hook) |
| `/privacy` | `Privacy` | No |
| `/terms` | `Terms` | No |
| `*` | `NotFound` | No |

Auth guard: `useRequireAuth` hook in `src/hooks/useRequireAuth.ts` returns `"loading" | "authenticated" | "unauthenticated"`.
