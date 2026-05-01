# Codebase Structure

**Analysis Date:** 2026-05-01

## Directory Layout

```
[project-root]/
├── travel-window-backend-staging-main/   # Express API
│   ├── api/                              # Vercel entry point
│   ├── middleware/                       # Auth middleware
│   ├── models/                           # Mongoose schemas
│   ├── routes/                           # API endpoints
│   └── scripts/                          # DB seed scripts
└── travel-window-frontend-staging-main/  # Angular Frontend
    ├── src/
    │   ├── app/
    │   │   ├── components/               # UI components
    │   │   ├── services/                 # API services
    │   │   ├── guards/                   # Route guards
    │   │   └── interceptors/             # HTTP interceptors
    │   ├── assets/                       # Static assets
    │   └── environments/                 # Configs
    └── tailwind.config.js                # Style config
```

## Directory Purposes

**Backend `routes/`:**
- Purpose: Defines API endpoints and handles request logic.
- Contains: JavaScript files for each resource (e.g., `bookings.js`, `users.js`).
- Key files: `bookings.js` (core logic).

**Backend `models/`:**
- Purpose: Database schema definitions.
- Contains: Mongoose models.
- Key files: `Booking.js`, `User.js`, `Supplier.js`.

**Frontend `src/app/components/`:**
- Purpose: UI implementation.
- Contains: Angular components organized by feature (Admin, Bookings, Dashboard).

## Key File Locations

**Entry Points:**
- `travel-window-backend-staging-main/api/index.js`: Vercel entry.
- `travel-window-backend-staging-main/server.js`: Local entry.
- `travel-window-frontend-staging-main/src/main.ts`: Frontend entry.

**Configuration:**
- `travel-window-backend-staging-main/.env.example`: Backend env template.
- `travel-window-frontend-staging-main/src/environments/`: Frontend envs.

**Core Logic:**
- `travel-window-backend-staging-main/routes/bookings.js`: Main business logic for bookings.

## Naming Conventions

**Files:**
- Backend: `snake_case.js` or `camelCase.js` (inconsistent, e.g., `auth.js` vs `create-admin.js`).
- Frontend: `component-name.component.ts` (Angular standard).

**Directories:**
- Kebab-case (e.g., `manage-suppliers`).

## Where to Add New Code

**New Feature (Backend):**
- Route: `routes/new-feature.js`
- Model: `models/NewFeature.js` (if needed)

**New Component (Frontend):**
- Implementation: `src/app/components/feature-name/`
- Service: `src/app/services/feature-name.service.ts`

## Special Directories

**`scripts/`:**
- Purpose: Database management (seeding, admin creation).
- Committed: Yes.

---

*Structure analysis: 2026-05-01*
