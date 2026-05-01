# Technology Stack

**Analysis Date:** 2026-05-01

## Languages

**Primary:**
- JavaScript (ES6+) - Backend (`travel-window-backend-staging-main`)
- TypeScript 5.5 - Frontend (`travel-window-frontend-staging-main`)

**Secondary:**
- HTML5 - Frontend templates
- SCSS/CSS - Styling

## Runtime

**Environment:**
- Node.js (Backend)
- Browser (Frontend)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present in both.

## Frameworks

**Core:**
- Express 4.18 - Backend API
- Angular 18.2 - Frontend Framework
- Tailwind CSS 3.4 - Styling

**Testing:**
- Jasmine/Karma - Frontend (configured in `package.json`)
- Not detected - Backend

**Build/Dev:**
- Angular CLI - Frontend build
- Nodemon - Backend development

## Key Dependencies

**Critical:**
- `mongoose` 7.6 - MongoDB ODM
- `jsonwebtoken` 9.0 - JWT Auth
- `bcryptjs` 2.4 - Password hashing
- `@angular/core` 18.2 - Frontend framework

**Infrastructure:**
- `cors` 2.8 - CORS middleware
- `dotenv` 16.3 - Environment variables
- `@vercel/analytics` - Vercel integration

## Configuration

**Environment:**
- `.env` files for backend
- `src/environments/` for frontend

**Build:**
- `angular.json`
- `vercel.json`
- `tailwind.config.js`

## Platform Requirements

**Development:**
- Node.js and npm installed.

**Production:**
- Vercel (Serverless Functions for Backend, Static Hosting for Frontend)

---

*Stack analysis: 2026-05-01*
