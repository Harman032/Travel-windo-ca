# Coding Conventions

**Analysis Date:** 2026-05-01

## Naming Patterns

**Files:**
- Backend: Lowercase, sometimes kebab-case (`create-admin.js`).
- Frontend: Kebab-case with type suffix (`.component.ts`, `.service.ts`).

**Functions:**
- camelCase (e.g., `calculateTotals`, `addProgressHistory`).

**Variables:**
- camelCase (e.g., `salePrice`, `travelDate`).

**Types:**
- PascalCase for Models and Interfaces.

## Code Style

**Formatting:**
- Prettier/ESLint suggested by `package.json` dependencies but config files may be missing or default.

**Linting:**
- Angular default linting for frontend.

## Import Organization

**Order:**
1. Built-in modules (Backend: `express`, `mongoose`).
2. Third-party packages.
3. Internal modules/models.

## Error Handling

**Patterns:**
- Backend: Try/catch blocks with `res.status(500).json(...)`.
- Frontend: Error handling in services via RxJS `catchError`.

## Logging

**Framework:** `console.error` and `console.log`.

**Patterns:**
- Log errors in catch blocks.

## Comments

**When to Comment:**
- Above helper functions (e.g., `// Helper function to calculate totals`).
- Explaining complex logic (e.g., `// Parse date inputs safely`).

## Function Design

**Size:** Varied; some routes are quite long (over 100 lines).

**Parameters:** Standard positional arguments or object destructuring.

**Return Values:** JSON responses in backend; Observables in frontend.

## Module Design

**Exports:**
- CommonJS `module.exports` (Backend).
- ES Modules `export class` (Frontend).

---

*Convention analysis: 2026-05-01*
