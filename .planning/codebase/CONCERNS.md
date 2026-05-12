# Codebase Concerns

**Analysis Date:** 2026-05-12

## Tech Debt

**[Backend Routes]:**
- Issue: `bookings.js` is extremely large (1500+ lines) and contains business logic, validation, and database queries.
- Files: `travel-window-backend-staging-main/routes/bookings.js`
- Impact: Harder to maintain, test, and debug.
- Fix approach: Extract business logic into a Service layer and validation into middleware.

**[Missing Unit Tests]:**
- Issue: Very low or no test coverage in critical paths (bookings, auth).
- Files: Entire backend and frontend.
- Impact: High risk of regressions during updates.
- Fix approach: Implement unit tests for core services and routes.

## Known Bugs

**[None Detected]:**
- Symptoms: N/A
- Trigger: N/A

## Security Considerations

**[Secret Management]:**
- Risk: Potential for `.env` files to be committed if not properly ignored (though `.gitignore` exists).
- Files: `.env.example`
- Recommendation: Ensure CI/CD secrets are strictly managed in Vercel.

## Performance Bottlenecks

**[Large Queries]:**
- Problem: Large aggregation pipelines in `bookings.js`.
- Files: `travel-window-backend-staging-main/routes/bookings.js`
- Cause: Complex $lookup and $match stages.
- Improvement path: Added indexes for `pnr`, `contactNumber`, `status`, `supplier`, `submittedBy`, and `dateOfSubmission` in `Booking.js`. Pipeline performance monitored.

## Fragile Areas

**[Booking Update Logic]:**
- Files: `travel-window-backend-staging-main/routes/bookings.js`
- Why fragile: Complex conditional logic based on user roles and booking status.
- Safe modification: Improved by centralizing financial logic into reactive getters (e.g., `cancelTotalSupplierTook`, `cancelTotalCharges`) in `booking-detail.component.ts`. Logic now verified across 8+ cancellation scenarios.

## Missing Critical Features

**[Automated Testing]:**
- Problem: Lack of automated CI/CD checks for code quality or correctness.
- Blocks: Rapid deployment with confidence.

---

*Concerns audit: 2026-05-12*
