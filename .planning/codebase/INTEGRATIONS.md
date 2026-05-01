# External Integrations

**Analysis Date:** 2026-05-01

## APIs & External Services

**Cloud Infrastructure:**
- Vercel - Hosting and Serverless deployment
  - SDK/Client: `@vercel/analytics`, `@vercel/speed-insights`
  - Auth: Vercel integration variables

**Security:**
- Google reCAPTCHA v2 (Optional) - Bot protection on login
  - Auth: `RECAPTCHA_SECRET`

## Data Storage

**Databases:**
- MongoDB (Atlas or local)
  - Connection: `MONGODB_URI` / `travel_window_MONGODB_URI`
  - Client: Mongoose

**File Storage:**
- Local filesystem / Not explicitly configured for cloud storage in core models.

**Caching:**
- None detected.

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication
  - Implementation: `jsonwebtoken` and `bcryptjs` in `travel-window-backend-staging-main/middleware/auth.js`

## Monitoring & Observability

**Error Tracking:**
- Vercel Analytics / Speed Insights
- Console logging in backend

**Logs:**
- Standard console output (monitored via Vercel logs)

## CI/CD & Deployment

**Hosting:**
- Vercel

**CI Pipeline:**
- Vercel Git integration

## Environment Configuration

**Required env vars:**
- `MONGODB_URI`: Database connection string
- `JWT_SECRET`: Secret for signing tokens
- `SEED_SECRET`: Secret for seeding database
- `RECAPTCHA_SECRET`: (Optional) Google reCAPTCHA key

**Secrets location:**
- Vercel Environment Variables (Production)
- `.env` files (Local development)

## Webhooks & Callbacks

**Incoming:**
- None detected.

**Outgoing:**
- None detected.

---

*Integration audit: 2026-05-01*
