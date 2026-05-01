# Architecture

**Analysis Date:** 2026-05-01

## Pattern Overview

**Overall:** Client-Server architecture with a RESTful API and a Single Page Application (SPA).

**Key Characteristics:**
- **Monolithic API:** Backend routes and logic are largely centralized in a single Express application.
- **Serverless Ready:** Backend is structured for deployment as Vercel serverless functions.
- **Component-Based UI:** Frontend uses Angular's modular component structure.

## Layers

**API Layer:**
- Purpose: Handles HTTP requests, validation, and routing.
- Location: `travel-window-backend-staging-main/routes/`
- Contains: Express route handlers.
- Depends on: Models, Middleware.
- Used by: Frontend SPA.

**Data Access Layer (Models):**
- Purpose: Defines data schema and interacts with MongoDB.
- Location: `travel-window-backend-staging-main/models/`
- Contains: Mongoose schemas (e.g., `User.js`, `Booking.js`).
- Depends on: Mongoose.
- Used by: Routes.

**Middleware Layer:**
- Purpose: Auth and authorization.
- Location: `travel-window-backend-staging-main/middleware/`
- Contains: `auth.js`.
- Used by: Routes.

**UI Layer (Components):**
- Purpose: Renders UI and handles user interaction.
- Location: `travel-window-frontend-staging-main/src/app/components/`
- Contains: Angular components.
- Depends on: Services.

**Service Layer (Frontend):**
- Purpose: Handles API communication and shared logic.
- Location: `travel-window-frontend-staging-main/src/app/services/`
- Contains: Angular services.

## Data Flow

**Booking Creation:**

1. Frontend component collects data and calls a service.
2. Service sends POST request to `/api/bookings`.
3. Backend route validates input, checks auth, and saves to MongoDB via Mongoose.

**State Management:**
- Backend: Stateless JWT-based sessions.
- Frontend: Local component state and RxJS observables in services.

## Key Abstractions

**Booking Management:**
- Purpose: Core business entity for the travel agency.
- Examples: `travel-window-backend-staging-main/models/Booking.js`, `travel-window-backend-staging-main/routes/bookings.js`
- Pattern: Active Record / Document-oriented.

## Entry Points

**Backend API:**
- Location: `travel-window-backend-staging-main/api/index.js` (Vercel) or `server.js` (Local)
- Triggers: HTTP Requests.
- Responsibilities: Server initialization and routing.

**Frontend SPA:**
- Location: `travel-window-frontend-staging-main/src/main.ts`
- Triggers: Browser load.
- Responsibilities: Bootstrapping the Angular application.

## Error Handling

**Strategy:** Global error catching in Express and Angular interceptors.

**Patterns:**
- Try/Catch blocks in backend routes with 500 status returns.
- Angular HTTP interceptors for handling 401/403 errors.

## Cross-Cutting Concerns

**Logging:** Console-based logging in backend.
**Validation:** `express-validator` (optional) and manual schema validation in Mongoose.
**Authentication:** JWT-based auth via custom middleware.

---

*Architecture analysis: 2026-05-01*
