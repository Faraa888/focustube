# Design for AI — Visual Design Principles

## FocusTube Context (Read First)
- Dark theme ONLY — no light mode, no toggle
- Primary: #e3093a (red) — CTAs, active states, brand
- Productive: #00bb13 (green)
- Distracting: #ed2b2b (red)
- Neutral: #ffb800 (yellow)
- Background: #121212
- Card: #212121
- Border: #333333
- Muted text: #b3b3b3
- Font: system font stack (Tailwind default — no custom imports)
- Components: shadcn/ui on Radix UI
- Icons: lucide-react only
- Tone: serious, focused, no playfulness
- No emojis anywhere in UI
- No purple gradients, no glassmorphism, no bounce easing
- Target user: wantrepreneurs and builders with a discipline problem

---

> Based on principles from Design for Hackers by David Kadavy

## Modes of Operation

**CHECKER** — audit existing designs
**APPLIER** — build from scratch

---

### CHECKER Mode

Run in order. Stop when a check fails.

**1. Purpose**
- [ ] Design has a clear purpose driving all decisions
- [ ] Polish level is appropriate — not over or under designed
- [ ] Serious, focused aesthetic — not generic AI output

**2. Typography**
- [ ] Body text passes squint test (even texture, no dark blotches)
- [ ] No fake bold, fake italic, stretched or compressed type
- [ ] Max two font families
- [ ] Proper typographic characters

**3. Proportions and Layout**
- [ ] Major element sizes relate through identifiable ratios
- [ ] Margins create geometric relationship between content and container
- [ ] Size progressions follow a consistent scale factor

**4. Composition**
- [ ] One element is clearly dominant (visual anchor)
- [ ] Eye is guided through composition
- [ ] Contrast supports intended hierarchy

**5. Visual Hierarchy**
- [ ] White space follows proportional system
- [ ] Type sizes differ by meaningful amounts
- [ ] Ornamentation is minimal

**6. Color**
- [ ] Palette matches FocusTube color system above
- [ ] No information conveyed by color alone
- [ ] Functional colors follow conventions (red=error/distracting, green=productive, yellow=neutral/warning)
- [ ] Shadows use hue-shifted colors, not pure black

**7. Motion and Interaction**
- [ ] Animations are purposeful — guide attention, show state change
- [ ] All interactive elements have proper states (hover, focus, active, disabled, loading, error, success)
- [ ] Loading states exist
- [ ] Duration 150–300ms standard, ease-out for entering, ease-in for exiting

**8. Responsive Design**
- [ ] Touch targets minimum 44x44px
- [ ] Layout is fluid with content-driven breakpoints

**9. Design Identity**
- [ ] No common AI design tells (cyan-on-dark, card-everything, glassmorphism, bounce easing)
- [ ] Feels intentionally designed for FocusTube, not generated

---

### APPLIER Mode

Follow this sequence when building from scratch.

**Phase 1: Foundation**
- Purpose: what should users feel? In control, aware, not judged
- FocusTube users are self-aware about their YouTube problem — design respects that
- Wireframes before any visual styling

**Phase 2: Structure**
- Use proportional system — 2:3 or 3:4
- Type scale: 12 / 14 / 16 / 18 / 24 / 32 / 48

**Phase 3: Typography**
- System font stack — no imports
- Leading 1.4–1.6 for body text
- Labels: text-sm font-medium
- Body: text-xl text-muted-foreground
- Headings: font-bold

**Phase 4: Composition and Hierarchy**
- White space first, then weight, size, color
- One dominant element per view
- Dashboard: data is the hero, UI is the frame

**Phase 5: Color**
- Start from #121212 background
- Cards: #212121
- Borders: #333333
- Use #e3093a sparingly — only for primary CTAs and critical states
- Green (#00bb13) for productive states only
- Never use color as the only signal

**Phase 6: Motion**
- Overlay entry: scale 0.96→1 + opacity 0→1, 200ms ease-out
- Overlay exit: opacity 1→0, 150ms ease-in
- Counter updates: no animation — just update value
- Toast: slide up from bottom-right, 200ms ease-out

**Phase 7: Responsive**
- Desktop first for dashboard (data-heavy)
- Mobile-aware for extension popup and overlays
- Touch targets 44px minimum

---

## Anti-Patterns for FocusTube

| Avoid | Why |
|-------|-----|
| Purple gradients on dark | Generic AI aesthetic |
| Glassmorphism | Distracting, doesn't fit serious tone |
| Bounce/spring easing on overlays | Feels playful — wrong tone for blocking content |
| Emojis in UI | Spec explicitly prohibits |
| Card-everything layouts | Creates visual noise on data-heavy dashboard |
| Bright accent colors everywhere | #e3093a should surprise, not saturate |
| Light backgrounds anywhere | Dark theme only, no exceptions |
