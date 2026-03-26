# UI_SPEC.md
# FocusTube — UI Specification (Rebuild Reference)

---

## 1. DESIGN SYSTEM

### Theme
Dark-theme only. No light mode. No toggle.

### Color Palette (CSS custom properties in `src/index.css`)

| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| `--background` | `0 0% 7%` | `#121212` | Page background |
| `--foreground` | `0 0% 100%` | `#ffffff` | Body text |
| `--card` | `0 0% 13%` | `#212121` | Card backgrounds |
| `--card-foreground` | `0 0% 100%` | `#ffffff` | Text on cards |
| `--primary` | `348 90% 48%` | `#e3093a` | CTAs, active states, brand |
| `--primary-foreground` | `0 0% 100%` | `#ffffff` | Text on primary |
| `--secondary` | `0 0% 16%` | `#292929` | Secondary buttons |
| `--secondary-foreground` | `0 0% 100%` | `#ffffff` | Text on secondary |
| `--muted` | `0 0% 20%` | `#333333` | Muted backgrounds |
| `--muted-foreground` | `0 0% 70%` | `#b3b3b3` | Subdued text |
| `--border` | `0 0% 20%` | `#333333` | All borders |
| `--input` | `0 0% 16%` | `#292929` | Input backgrounds |
| `--ring` | `348 90% 48%` | `#e3093a` | Focus rings |
| `--destructive` | `0 84.2% 60.2%` | `#f56565` | Errors |

**Data visualization colors (inline in chart components):**
- Distracting: `#ed2b2b`
- Neutral: `#ffb800`
- Productive: `#00bb13`
 
**Status colors (Tailwind utilities):**
- Success: `text-green-500`
- Warning: `text-yellow-500`
- Error: `text-red-500`
- Upgrade banner: `bg-yellow-500/10 border-yellow-500/30 text-yellow-500`

### Typography
System font stack (Tailwind default — no custom font import needed).

| Usage | Classes |
|-------|---------|
| H1 hero | `text-5xl md:text-7xl font-bold` |
| H2 sections | `text-3xl md:text-4xl font-bold` |
| Card titles | `text-2xl font-semibold` |
| Sub-headings | `text-xl font-semibold` |
| Body | `text-xl text-muted-foreground` |
| Labels | `text-sm font-medium` |
| Captions | `text-xs text-muted-foreground` |
| Brand name | `text-2xl font-bold text-primary` |

### Spacing
| Pattern | Value |
|---------|-------|
| Container padding | `px-4` |
| Section vertical | `py-20` |
| Hero top | `pt-32 pb-20` |
| App page top margin | `mt-16` (clears 64px fixed header) |
| Card padding | `p-6` |
| Grid gap | `gap-6` or `gap-8` |
| Form field spacing | `space-y-4` or `space-y-6` |

### Border Radius
| Class | Value |
|-------|-------|
| `rounded-lg` | `0.5rem` — cards, inputs, containers |
| `rounded-md` | `0.375rem` — buttons |
| `rounded-full` | `9999px` — badges |

### Backgrounds
- `bg-background` — all page roots
- `bg-card` — card components
- `bg-primary/10` — icon containers, info banners
- `bg-muted/50` — hover states, info boxes
- `bg-black/80 backdrop-blur-sm` — overlay locks
- `bg-background/95 backdrop-blur-lg` — fixed header

---

## 2. COMPONENT LIBRARY

**UI library:** shadcn/ui on Radix UI primitives. All components in `src/components/ui/`.

**Icon library:** `lucide-react`

### Button Variants
| Variant | Classes | Usage |
|---------|---------|-------|
| `default` | `bg-primary text-primary-foreground hover:bg-primary/90` | Primary CTAs |
| `destructive` | `bg-destructive text-destructive-foreground` | Dangerous actions |
| `outline` | `border border-input bg-background hover:bg-accent` | Secondary actions |
| `secondary` | `bg-secondary text-secondary-foreground` | Less prominent |
| `ghost` | `hover:bg-accent hover:text-accent-foreground` | Icon buttons |
| `link` | `text-primary underline-offset-4 hover:underline` | Inline links |

**Button sizes:**
- `default`: `h-10 px-4 py-2`
- `sm`: `h-9 rounded-md px-3`
- `lg`: `h-11 rounded-md px-8`
- `icon`: `h-10 w-10`

### Form Pattern
```jsx
<form className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="field">Label</Label>
    <Input id="field" name="field" type="..." placeholder="..." required />
  </div>
  <Button type="submit" className="w-full" disabled={loading}>
    {loading ? "Saving..." : "Save"}
  </Button>
</form>
```

### Card Pattern
```jsx
<Card className="max-w-md mx-auto">
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* content */}
  </CardContent>
</Card>
```

### Error States
| Context | Pattern |
|---------|---------|
| Form inline | `<div className="text-sm text-red-500 text-center">message</div>` |
| Alert | `<Alert variant="destructive"><AlertTitle /><AlertDescription /></Alert>` |
| Card error | Card with `border-destructive/50 bg-destructive/5` + retry button |
| Field validation | `<p className="text-sm text-destructive">message</p>` |

### Loading States
| Context | Pattern |
|---------|---------|
| Full page | `min-h-screen flex items-center justify-center text-muted-foreground` |
| Dashboard | `text-center py-12 text-muted-foreground` |
| Button | `disabled={loading}` + text: "Saving...", "Creating account...", etc. |
| Goals submit | Two states: "Normalising channel names..." → "Saving..." |

### Empty States
`<p className="text-sm text-muted-foreground text-center py-8">message</p>`

### Success Messages
Use `toast()` from Sonner for all success feedback:
```ts
toast({ title: "Saved", description: "Your changes have been updated." })
```

### Upgrade / Paywall States
- **Settings lock:** `absolute inset-0 bg-black/80 backdrop-blur-sm z-50` — full-page overlay over blurred content
- **Dashboard banner:** `bg-yellow-500/10 border border-yellow-500/30` with yellow upgrade button

---

## 3. ROUTING

| Path | Component | Auth required |
|------|-----------|---------------|
| `/` | `Home` | No |
| `/pricing` | `Pricing` | No |
| `/download` | `Download` | No |
| `/signup` | `Signup` | No (redirect to dashboard if session) |
| `/login` | `Login` | No (redirect to dashboard if session) |
| `/forgot-password` | `ForgotPassword` | No — **must be built** |
| `/goals` | `Goals` | Yes (redirect to /login if no session) |
| `/app/dashboard` | `Dashboard` | Yes (`useRequireAuth`) |
| `/app/settings` | `Settings` | Yes (`useRequireAuth`) |
| `/privacy` | `Privacy` | No |
| `/terms` | `Terms` | No |
| `*` | `NotFound` | No |

Auth guard: `useRequireAuth` hook returns `"loading" | "authenticated" | "unauthenticated"`.

---

## 4. PAGE LAYOUTS

### Landing Page (`/`)

**Header (fixed, full-width):**
- `bg-background/95 backdrop-blur-lg border-b border-border`
- Left: Brand name `FocusTube` in `text-primary`
- Center: Nav links — Features, Pricing, Download (`hover:text-primary transition-colors`)
- Right: "Start Free Trial" button (hidden on mobile) + mobile Sheet menu
- Height: 64px

**Hero section:**
- `pt-32 pb-20 text-center`
- H1: "No More YouTube Spirals"
- Subheadline: "FocusTube adds friction where you spiral and clarity when you drift — so YouTube stops wasting your time and you remain in control."
- CTA buttons: `flex-col sm:flex-row gap-4`
  - Primary: "Start Free Trial" → `/signup`
  - Secondary outline: "See How It Works" → scroll to features

**Problem section:**
- `py-20 bg-card/30`
- Headline + body copy from PRODUCT_SPEC section 17

**Features section:**
- `py-20`
- Grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
- FeatureCard component: `bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/10`
- Icon container: `w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4`

**Pricing section:**
- `py-20 bg-card/50`
- Two cards: Free (expired) and Pro
- Pro card: `border-2 border-primary relative` with "Most Popular" badge

**Final CTA section:**
- `py-20 bg-primary/5`
- Headline + "Start Free Trial" button

**Footer:**
- `border-t border-border bg-card mt-20`
- Grid: `grid grid-cols-1 md:grid-cols-4 gap-8`
- Columns: Brand blurb · Product links · Legal links · Support email

---

### Signup Page (`/signup`)

- Max width: `max-w-md`
- Single `Card` centered on page
- `CardHeader`: "Create your account" + "Start your 14-day free trial"

**Form fields:**
1. Email (type="email", required)
2. Password (type="password", min 8 chars, required)
3. Submit button: "Create account" / "Creating account..."

**OAuth section:**
- `Separator` with "or" label between OAuth and email form
- "Continue with Google" button (outline variant, full width, Google icon)
- OAuth above or below email form (above is standard)

**Below form:**
- "Already have an account? Sign in" → `/login`
- On email signup success: green `Alert` with email confirmation message
- Disposable email error: inline red error below submit button

---

### Login Page (`/login`)

- Max width: `max-w-md`
- Same layout as Signup
- `CardHeader`: "Welcome back" + "Sign in to your account"

**Form fields:**
1. Email
2. Password
3. "Forgot password?" link → `/forgot-password` (right-aligned, `text-sm`)
4. Submit button: "Sign in" / "Signing in..."

**OAuth:**
- Same as Signup — "Continue with Google" button

**Below form:**
- "Don't have an account? Start free trial" → `/signup`

---

### Forgot Password Page (`/forgot-password`)

- Max width: `max-w-md`
- `CardHeader`: "Reset your password"
- One field: Email
- Submit: "Send reset link"
- On success: green Alert — "Check your email for a reset link"
- Back link: "Back to sign in" → `/login`

---

### Goals Page (`/goals`) — Onboarding

- Max width: `max-w-2xl`
- Progress indicator optional (single step for MVP)
- `CardHeader`: "Set up your focus profile" + description

**Form fields:**

1. **Goals** — Textarea, placeholder: "e.g. Learn to code, Build my SaaS, Improve my marketing skills"
2. **Pitfalls** — Textarea, placeholder: "e.g. gaming videos, vlogs, reaction videos, celebrity drama"

**Submit button:** "Save and start using FocusTube" / "Saving..."

No channel blocking input on this page. Channels are blocked directly on YouTube via the Block Channel button.

**Skip link:** "Skip for now" — saves empty, navigates to YouTube

---

### Dashboard Page (`/app/dashboard`)

- Max width: `max-w-6xl`, `container mx-auto`
- `mt-16` for fixed header clearance

**For Free/Expired users:**
- Show blurred placeholder cards with yellow upgrade banner at top
- Banner: `bg-yellow-500/10 border border-yellow-500/30` + yellow "Upgrade to Pro" button
- Not an error state — always renders something

**For Trial/Pro users:**

**Top row — Summary stats (3-column grid on md+):**
- Focus Score card: large number, colour-coded (green >60%, yellow 40-60%, red <40%)
- Total watch time card
- Most active time card: "Peak: 9–11pm"

**Time range selector:**
- Tabs or segmented control: "7 days" / "30 days" / "All time"

**Watch time chart:**
- Stacked bar chart by hour of day
- Colors: distracting (`#ed2b2b`), neutral (`#ffb800`), productive (`#00bb13`)
- Built with Recharts

**Bottom row (2-column grid on md+):**

Left — **Most watched channels:**
- List ranked by total time
- Channel name + watch time

Right — **Biggest distractions:**
- List of distracting channels ranked by time
- Channel name + time + "Block" button (sm size, outline variant)
- Clicking "Block" calls `/extension/save-data` with updated blocked_channels array

**Empty state:** "Start watching to see your focus patterns here."

---

### Settings Page (`/app/settings`)

- Max width: `max-w-4xl`, `container mx-auto`
- `mt-16` for header clearance
- Tabs: `grid w-full grid-cols-4` (or fewer tabs if simplified)

**For Free/Expired users:** Full-page lock overlay — `absolute inset-0 bg-black/80 backdrop-blur-sm z-50` with upgrade modal centered.

**Tab 1: Goals**
- Edit Goals textarea
- Edit Pitfalls textarea
- Save button

**Tab 2: Channels**
- Read-only list of blocked channels with two columns: @handle | date blocked
- Below list: "To unblock a channel, email support@focustube.co.uk"
- Empty state: "No channels blocked yet. Visit a YouTube channel and click Block Channel to add one."
- No add/remove controls — channels are blocked exclusively via the extension's Block Channel button on YouTube

**Tab 3: Controls**
- Block Shorts toggle (Switch) — label: "Block Shorts entirely"
- Hide recommendations toggle (Switch) — label: "Hide YouTube recommendations"
- "Enable daily watch limit" toggle (Switch, off by default for new users)
  - When off: daily_limit_minutes = 0 (disabled), slider hidden
  - When on: slider visible, default 60 minutes, range 1–120
  - Label: "Daily watch limit", Badge shows "X minutes"
- Focus Window section:
  - Enabled toggle (Switch)
  - Start time Select (15-min increments, 08:00–22:00)
  - End time Select (15-min increments, 08:00–22:00)
  - Validation: must be within 08:00–22:00, max 6 hours
  - Error inline: `text-sm text-destructive`

**Tab 4: Plan**
- Plan status: "Pro trial — X days remaining" or "Pro plan"
- Upgrade CTA (if on trial): primary button "Upgrade to Pro — $5/month"
- Billing: link to Stripe customer portal (if Pro)

---

### Extension Popup (`popup.html`)

Fixed dimensions: `320px` wide, auto height. Dark theme matching web app.

**Logged-out state:**
```
FocusTube                    [logo/icon]

Welcome to FocusTube.
Sign in or start your free trial to take back
control over YouTube.

[Start Free Trial]   full-width primary button
[Sign In]            full-width outline button
```

**Trial state:**
```
FocusTube                    [logo/icon]

user@email.com
Pro trial: 23 days left

[Upgrade to Pro]             yellow button
[View Dashboard]             outline button
[Settings]                   outline button
```

**Pro state:**
```
FocusTube                    [logo/icon]

user@email.com
Pro plan ✓

[View Dashboard]             outline button
[Settings]                   outline button
```

**Expired state:**
```
FocusTube                    [logo/icon]

Your 14-day trial has ended.

You watched X hours this month.
FocusTube helped you stay focused for Y% of that time.

[Upgrade to Pro — $5/month]  primary button
[No thanks, uninstall]       ghost/link button
```

**Upgrade nudge (days 17, 23, 27, 28, 29) — shown above normal content:**
```
Your trial ends in X days.
Upgrade to keep your focus.

[Upgrade Now]                primary button
[Dismiss]                    ghost button
```

---

## 5. VISUAL OVERLAYS (EXTENSION)

All overlays and persistent UI injected by `content.js` into the YouTube DOM.

### DESIGN PHILOSOPHY
FocusTube UI exists on a spectrum from ambient to invasive.
Invasiveness must match the severity of the moment.
Never compete with YouTube's own UI unless the intervention is intentional.

| Level | Elements | Behaviour |
|-------|----------|-----------|
| Ambient | Watch time counter, search counter, shorts counter, trial banner | Small, low opacity at rest. Visible on hover. Never jarring. |
| Nudge | Distracting/productive countdown overlays, channel spiral toasts | Intentional interruption. Countdown makes them feel fair. |
| Block | Hard block, daily limit, focus window | Fully invasive by design. User set these rules themselves. |

---

### AMBIENT ELEMENTS (rest state / hover state)

#### Watch Time Counter
- **Rest state:** Fixed bottom-right, `opacity: 0.35`, `font-size: 11px`, `padding: 4px 10px`
  Background: `rgba(0,0,0,0.5)`, `border-radius: 6px`
  Content: "Xh Ym" — no label
- **Hover state:** `opacity: 1`, shows full label "Today: Xh Ym", smooth 150ms transition
- Visible on all YouTube pages including fullscreen
- Never destroyed by nudge overlays — only hidden by full-screen blocks, restored after

#### Shorts Counter
- Same style as watch time counter
- Only injected on `/shorts/` URLs
- Rest state content: "Xm · Y" — expands to "Shorts: Xm · Y videos" on hover
- Appears after first Short watched, not on page load

#### Search Counter
- Injected only when user focuses the YouTube search bar
- Appears below search input as a small pill: "X / 15"
- Color: `#b3b3b3` normal → `#eab308` at 13–14 → `#ef4444` at 15
- Disappears when search bar loses focus (unless at warning state)
- At 15: remains visible, blocks search navigation

#### Trial Expiry Banner
- **Not** a full-width top banner
- Small fixed pill, bottom-left corner
- Rest state: `opacity: 0.5`, shows "X days left"
- Hover state: expands to show "Your trial ends in X days. Upgrade to keep your focus." + [Upgrade Now] button
- Background: `rgba(234,179,8,0.15)`, border: `1px solid rgba(234,179,8,0.3)`, text: `#eab308`
- Dismissed on click of X — once per day, stored in `ft_trial_nudge_dismissed_date`
- Only shown on days 7, 10, 11, 12, 13 of trial

---

### NUDGE OVERLAYS (intentional interruption)

#### Distracting Nudge Overlay (10s / 30s)
- Fixed full-screen, `z-index: 9999`
- Background: `rgba(0,0,0,0.85)` with `backdrop-filter: blur(4px)`
- Centered card: `background: #212121`, `border: 1px solid #333333`, `border-radius: 12px`, `padding: 32px 40px`
- Accent: `#e3093a` red
- Countdown: large monospace number, bold, dominant visual element
- Message: smaller, muted — `color: #b3b3b3`, `font-size: 14px`
- Entry animation: card scale 0.96 → 1.0 + opacity 0 → 1, 200ms ease-out
- Non-dismissable. No close button.
- After countdown: removes itself, video resumes

#### Productive Nudge Overlay (5s / 30s / 5-min soft break)
- Same structure as distracting overlay
- Accent: `#00bb13` green instead of red
- Tone is encouraging, not punitive

#### Channel Spiral Toast (3x same channel / 5x in 7 days)
- NOT a full overlay — small toast, bottom-right, above watch time counter
- `width: 280px`, card style, dismissable X button
- Auto-dismisses after 5 seconds if not interacted with
- 3x same day: "You've watched [Channel] 3 times today."
- 5x in 7 days: "You keep coming back to [Channel]. Intentional?"
- Entry: slides up from bottom-right, 200ms ease-out

---

### BLOCK OVERLAYS (fully invasive — user-defined rules)

These are intentionally jarring. The user set these rules themselves.
All block overlays: fixed full-screen, `z-index: 9999`, non-dismissable during block period.
All block overlays: hide ambient elements (watch time counter, shorts counter, trial banner) during block. Restore them after block ends.

#### Hard Block Overlay (4+ distracting videos / 45+ mins)
- Background: solid `#121212` — no transparency, no blur
- Centered content: FocusTube wordmark, block message, large countdown (5 minutes)
- Message: "Take a break. Come back in 5 minutes."
- Countdown: large monospace, `color: #e3093a`
- After 5 minutes: removes itself, restores ambient elements, video can resume
- Counters do NOT reset — persist until midnight

#### Daily Limit Block Overlay
- Same as hard block
- No countdown — blocked rest of day
- Message: "You've hit your daily limit. See you tomorrow."
- Shows time until local midnight: "Resets in Xh Ym"

#### Focus Window Block Overlay
- Same as hard block
- Message: "Outside your focus hours. YouTube is blocked until [time]."
- Shows exact unlock time

#### Channel Block Overlay (Dismissable)
- Semi-transparent overlay — `rgba(0,0,0,0.85)` not solid
- Dismissable: X button top-right
- Redirects to youtube.com on dismiss
- Message: "Channel blocked."
- Auto-redirects after 3 seconds if not dismissed

#### Shorts Block Overlay (Dismissable)
- Same as channel block overlay
- Message: "Shorts blocked."
- Auto-redirects after 3 seconds

## 6. RESPONSIVE DESIGN

### Breakpoints (Tailwind defaults)
| Breakpoint | Width | Usage |
|------------|-------|-------|
| `sm` | 640px | Hero CTA row switches to row layout |
| `md` | 768px | Header nav visible, grids activate |
| `lg` | 1024px | Feature grid goes to 3 columns |
| `2xl` | 1400px | Container max-width cap |

### Mobile-Specific Patterns
- Header nav: `hidden md:flex` — replaced by Sheet drawer on mobile
- "Start Free Trial" in header: `hidden md:inline-flex`
- Hero CTAs: `flex-col sm:flex-row gap-4`
- Settings tabs: `grid w-full grid-cols-4` — may need `grid-cols-2` on mobile

### Desktop-Specific Patterns
- Feature grid: `lg:grid-cols-3`
- Dashboard grid: `md:grid-cols-2`
- Pricing cards: `md:grid-cols-2`
- Footer: `md:grid-cols-4`
- Page max-widths: `max-w-4xl` (Settings), `max-w-6xl` (Dashboard hero)

---

## 7. ICON CONVENTIONS (lucide-react)

| Size | Class | Usage |
|------|-------|-------|
| Small | `h-4 w-4` | Button icons, inline |
| Medium | `h-5 w-5` | Feature list items, form icons |
| Large | `h-6 w-6` | Card alerts, nav |
| XL | `h-12 w-12` | Feature card icons |

Icons in use: `Shield`, `Sparkles`, `Clock`, `BarChart3`, `Zap`, `Ban`, `Check`, `Menu`, `LogOut`, `Chrome`, `Download`, `CheckCircle2`, `AlertCircle`, `AlertTriangle`, `X`, `Plus`, `Info`, `Flame`, `TrendingUp`

---

## 8. HOVER & TRANSITION PATTERNS

| Pattern | Usage |
|---------|-------|
| `hover:text-primary transition-colors` | Nav links |
| `hover:border-primary/50 hover:shadow-lg` | FeatureCard |
| `hover:bg-muted/50 transition-colors` | Settings list items |
| `hover:bg-primary/90` | Primary button (built-in) |
| `hover:underline` | Footer links, inline links |
