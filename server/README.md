# FocusTube Server

Express backend server for FocusTube extension.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Configure environment variables in `.env` (optional for stubs):
- `PORT=3000` (default)
- `SUPABASE_URL=` (for future use)
- `SUPABASE_SERVICE_ROLE_KEY=` (for future use)
- `STRIPE_SECRET_KEY=` (for future use)
- `STRIPE_WEBHOOK_SECRET=` (for future use)
- `OPENAI_API_KEY=` (for future use)
- `NODE_ENV=development`

## Development

Run in development mode with hot reload:
```bash
npm run dev
```

Server will start on `http://localhost:3000`

## Endpoints

- `GET /health` - Health check endpoint
- `POST /ai/classify` - AI classification (stub - returns neutral)
- `GET /license/verify` - License verification (stub - returns free plan)
- `POST /webhook/stripe` - Stripe webhook handler (stub - logs event)

All endpoints are currently stubs and will be fully implemented in future lessons.

## Build

Build TypeScript:
```bash
npm run build
```

Run production build:
```bash
npm start
```

