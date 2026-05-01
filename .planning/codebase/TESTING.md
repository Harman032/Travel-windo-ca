# Testing Patterns

**Analysis Date:** 2026-05-01

## Test Framework

**Runner:**
- Jasmine/Karma (Frontend)
- Not detected (Backend)

**Assertion Library:**
- Jasmine (Frontend)

**Run Commands:**
```bash
ng test                # Run frontend tests
```

## Test File Organization

**Location:**
- Co-located with components (Angular standard: `.spec.ts`), though many are currently missing or minimal.

**Naming:**
- `*.spec.ts`

## Test Structure

**Suite Organization:**
```typescript
describe('ComponentName', () => {
  it('should create', () => {
    // ...
  });
});
```

## Mocking

**Framework:** Jasmine Spies.

## Fixtures and Factories

**Test Data:**
- Manual object creation in tests (none detected in current mapping).

## Coverage

**Requirements:** None enforced.

## Test Types

**Unit Tests:**
- Intended for Angular components/services.

**Integration Tests:**
- None detected.

**E2E Tests:**
- None detected.

---

*Testing analysis: 2026-05-01*
