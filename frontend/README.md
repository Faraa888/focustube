# FocusTube - Frontend

A Chrome extension companion website for helping users use YouTube intentionally.

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Routing**: React Router v6
- **State**: React Query for async state
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- npm, yarn, or bun

### Installation

```bash
# Install dependencies
npm install
# or
bun install
```

### Development

```bash
# Start dev server (usually http://localhost:5173)
npm run dev
# or
bun dev
```

### Build

```bash
# Create production build
npm run build
# or
bun run build
```

### Preview Production Build

```bash
npm run preview
# or
bun run preview
```

## Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── Header.tsx       # Global navigation
│   ├── Footer.tsx       # Global footer
│   └── FeatureCard.tsx  # Reusable feature card
├── pages/
│   ├── Home.tsx         # Landing page (/)
│   ├── Pricing.tsx      # Pricing page (/pricing)
│   ├── Download.tsx     # Extension download (/download)
│   ├── Login.tsx        # Login page (/login)
│   ├── Signup.tsx       # Signup page (/signup)
│   ├── Dashboard.tsx    # Pro dashboard (/app/dashboard)
│   ├── Settings.tsx     # Settings page (/app/settings)
│   ├── Privacy.tsx      # Privacy policy (/privacy)
│   ├── Terms.tsx        # Terms of service (/terms)
│   └── NotFound.tsx     # 404 page
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions
├── assets/              # Images, fonts
├── index.css            # Global styles & design system
└── App.tsx              # Main app with routing
```

## Customization

### Brand Colors

Edit `src/index.css` to customize the design system:

```css
:root {
  --primary: 348 90% 48%;        /* #E50914 - Deep red */
  --background: 0 0% 7%;         /* #121212 - Charcoal */
  --foreground: 0 0% 100%;       /* #FFFFFF - White text */
  --muted-foreground: 0 0% 70%;  /* #B3B3B3 - Muted text */
  /* ... more variables */
}
```

### Adding New Pages

1. Create component in `src/pages/YourPage.tsx`
2. Add route in `src/App.tsx`:
```tsx
<Route path="/your-path" element={<YourPage />} />
```
3. Add navigation link in `src/components/Header.tsx`

## Integration TODOs

The following features are UI-only and need backend integration:

### Authentication (Login/Signup)
- [ ] Connect Google OAuth (`handleGoogleLogin`, `handleGoogleSignup`)
- [ ] Implement email/password auth
- [ ] Add session management
- [ ] Protect dashboard/settings routes

### Stripe Payments
- [ ] Replace `/checkout/pro` placeholder with real Stripe checkout
- [ ] Add subscription management in Settings
- [ ] Implement webhook handlers for subscription events

### Extension Communication
- [ ] Connect dashboard to extension data (watch time, focus score, etc.)
- [ ] Sync settings between web app and extension
- [ ] Implement "extension connected" detection

### Chrome Web Store
- [ ] Replace `YOUR_EXTENSION_ID` in Download page with actual extension ID
- [ ] Update `CHROME_STORE_URL` constant

### Analytics
- [ ] Wire up `data-evt` attributes to analytics service (e.g., Google Analytics, Mixpanel)

### Backend APIs
- [ ] Save/load user settings
- [ ] Store usage analytics
- [ ] Sync goals and anti-goals

## Analytics Events

All CTAs include `data-evt` attributes for tracking:
- `start_trial` - Hero CTA clicks
- `buy_pro` - Pro upgrade clicks  
- `install_extension` - Extension download clicks
- `login_google`, `login_email` - Login method tracking
- `signup_google`, `signup_email` - Signup method tracking

## Deployment

The app is ready to deploy to:
- Netlify
- Vercel  
- Cloudflare Pages
- AWS Amplify
- Any static hosting service

### Environment Variables

No environment variables required for frontend-only mode. When integrating backend:

```env
# Example .env (not included in repo)
VITE_API_URL=https://api.focustube.com
VITE_STRIPE_PUBLIC_KEY=pk_live_xxx
VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

## Accessibility

- All interactive elements are keyboard accessible
- Semantic HTML5 landmarks
- ARIA labels on icon-only buttons
- Focus visible states on all controls
- Meets WCAG AA contrast requirements

## Browser Support

- Chrome 90+
- Edge 90+
- Firefox 88+
- Safari 14+

## License

Proprietary - All rights reserved

## Support

For questions or issues:
- Email: support@focustube.com
- Docs: (coming soon)
