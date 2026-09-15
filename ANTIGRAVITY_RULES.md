# ShopSphere --- Antigravity IDE Agent Rules

## Project Mission

Build ShopSphere as a production-oriented single-vendor e-commerce
platform whose strongest aspect is backend engineering depth.

## Working Method

Always follow: `PLAN → IMPLEMENT → TEST → REVIEW → VERIFY → COMMIT`

Never generate the entire project in one uncontrolled step.

## Rules

1.  Read the relevant PRD before implementing a feature.
2.  Inspect existing code before changing it.
3.  Make the smallest coherent change.
4.  Do not rewrite unrelated working code.
5.  Prefer a modular monolith.
6.  Do not add technologies just for resume keywords.
7.  Never trust client-provided price, discount, total, stock, role or
    payment state.
8.  Enforce authorization on backend routes.
9.  Keep payment secrets server-side.
10. Make payment/webhook processing idempotent.
11. Protect inventory from concurrent overselling.
12. Use validation at API boundaries.
13. Use centralized error handling.
14. Use meaningful HTTP status codes.
15. Add regression tests for important bug fixes.
16. Never claim a feature works without verification.
17. Do not commit secrets or .env files.
18. Do not log passwords, tokens or payment secrets.
19. Avoid unnecessary dependencies.
20. Explain large architectural changes before implementing them.

## Backend Priority

When choosing between a fancy UI improvement and a backend
reliability/security improvement, prioritize the backend improvement.

## Frontend Rules

-   Keep the interface professional and restrained.
-   Avoid AI-looking gradients, glassmorphism, neon, blobs and excessive
    animation.
-   Do not make frontend state authoritative for money, permissions or
    inventory.
-   Include loading, error, empty and disabled states.
-   Maintain responsive and accessible layouts.

## Verification

For each milestone report: - Files changed - APIs/features added -
Tests/checks executed - Results - Known risks

For major workflows use browser/API verification after implementation.

## Refactoring

Refactor only when it improves correctness, maintainability or
testability. Do not refactor solely to make the code look different.

## Interview Depth

Preserve clear code and documentation around: - authentication -
authorization - indexes - pagination - inventory concurrency - payment
verification - idempotency - error handling - scalability
