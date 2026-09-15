# ShopSphere --- Implementation Phases & Engineering Roadmap

## Overall Project Progress

- **Project:** ShopSphere (Single-Vendor Production-Oriented E-Commerce Platform)
- **Primary Focus:** Backend Engineering Depth, Correctness, Security, Reliability & Maintainability
- **Architecture:** Modular Monolith (Node.js/Express + MongoDB Atlas + React/Vite)
- **Overall Progress:** 12%
- **Current Phase:** Phase 2 --- Authentication & Authorization System
- **Status Summary:**
  - Completed:
    - Phase 0 --- Project Planning & Repository Setup
    - Phase 1 --- Backend Foundation & Core Infrastructure (with MongoDB & Git Milestone)
  - In Progress: None
  - Next: Phase 2 --- Authentication & Authorization System

---

## Architectural Alignment & Checkout State Machine

ShopSphere strictly follows the robust checkout and inventory pipeline specified in the system design:

```
Customer
  ↓
Cart
  ↓
Backend validates current products/prices/stock (Authoritative Re-read)
  ↓
Inventory reservation (Atomic conditional decrement: stock >= requestedQuantity)
  ↓
Pending payment order (Status: PENDING_PAYMENT, reservationExpiresAt = NOW + 15 min)
  ↓
Razorpay order (Server-calculated total in paise, razorpayOrderId linked to Order)
  ↓
Razorpay checkout (Client modal opens with server-signed razorpayOrderId)
  ↓
Payment verification (Client signature verification OR Webhook event)
  ↓
Webhook/reconciliation (HMAC SHA256 signature verification)
  ↓
Idempotent payment processing (Atomic status transition where paymentStatus != 'PAID')
  ↓
Order confirmation (Status: CONFIRMED, paymentStatus: PAID, paidAt recorded)
  ↓
Inventory finalized (Reservation confirmed, stock committed)
  ↓
Cart cleared (User cart emptied)
```

### Critical Edge Cases Handled in Architecture
1. **Concurrent Purchases & Overselling:** Prevented via atomic conditional updates (`{ _id: productId, stock: { $gte: quantity } }`) and Mongo transaction session.
2. **Abandoned Checkout / Reservation Expiration:** Orders in `PENDING_PAYMENT` have a 15-minute TTL. A background reconciliation worker cancels expired orders and atomically restores stock (`$inc: { stock: +quantity }`).
3. **Payment Failure:** Explicit failure transitions order to `PAYMENT_FAILED` and immediately returns reserved stock to inventory.
4. **Duplicate Webhooks & Race with Client Verification:** Both routes execute through a centralized idempotent payment service. The database update uses a conditional query (`paymentStatus: { $ne: 'PAID' }`), ensuring exactly-once execution.
5. **Server Failure During Payment:** The Razorpay webhook reconciles any payments that succeeded even if the client crashed or disconnected before submitting `/api/payments/verify`.

---

## Phase Roadmap Overview

| Phase | Title | Focus Area | Status |
|---|---|---|---|
| **Phase 0** | Project Planning & Repository Setup | Workspace, tooling, directory structure & standards | **COMPLETED** |
| **Phase 1** | Backend Foundation & Core Infrastructure | Express app, DB connection, error handling & logging | **COMPLETED** |
| **Phase 2** | Authentication & Authorization | JWT in HTTP-only cookies, bcrypt, RBAC & auth middleware | **NOT STARTED** |
| **Phase 3** | Category & Product Management | Catalog schema, Admin CRUD & Cloudinary image pipeline | **NOT STARTED** |
| **Phase 4** | Product Discovery: Search, Filter, Sort & Pagination | Public catalog API, compound indexing & query parsing | **NOT STARTED** |
| **Phase 5** | Shopping Cart Engine | Cart model, authoritative server pricing & live validation | **NOT STARTED** |
| **Phase 6** | Checkout & Inventory Reservation | Atomic reservation, TTL worker, snapshots & pending orders | **NOT STARTED** |
| **Phase 7** | Razorpay Payment Integration & Webhook Reconciliation | Signature verification, idempotent handler & dual-path lock | **NOT STARTED** |
| **Phase 8** | Order Lifecycle & Cancellation Management | Order state machine, user history, admin actions & restock | **NOT STARTED** |
| **Phase 9** | Customer Reviews & Wishlist | Verified purchaser gating, atomic rating aggregation & wishlist | **NOT STARTED** |
| **Phase 10** | Admin Dashboard & Operational Metrics | Aggregation pipelines, sales metrics, inventory alerts | **NOT STARTED** |
| **Phase 11** | Frontend Integration & UX Polish | React UI, clean aesthetic, Razorpay SDK & error/loading states | **NOT STARTED** |
| **Phase 12** | Comprehensive Testing & Concurrency Verification | Unit, integration & high-concurrency overselling tests | **NOT STARTED** |
| **Phase 13** | Security Hardening & Performance Optimization | Rate limiting, Helmet, CORS, sanitize & query profiling | **NOT STARTED** |
| **Phase 14** | Production Deployment & CI/CD | Vercel (Frontend), Render (Backend), Atlas & monitoring | **NOT STARTED** |
| **Phase 15** | Final Documentation & Interview Preparation | System architecture docs, trade-off cheat-sheet & verify | **NOT STARTED** |

---

## Phase 0 --- Project Planning & Repository Setup

- **Status:** COMPLETED
- **1. Objective:** Establish the monorepo/workspace structure, configure dependencies, establish code style/linting, isolate environment configurations, set up strict `.gitignore` rules, and organize all project documentation into `docs/`.
- **2. Why this phase exists:** A predictable modular structure is required before writing application logic. Establishing standardized folder hierarchies, linting, and environment schemas early avoids painful refactoring later. Setting up `.gitignore` prior to any code generation guarantees database credentials and `node_modules` are never leaked.
- **3. Prerequisites:** Node.js (v18+ or v20+ LTS), Git, npm.
- **4. Features/tasks:**
  - Create root workspace with `server/` (Express API) and `client/` (React + Vite).
  - Consolidate root markdown documentation into `docs/` (`docs/PRD.md`, `docs/TECHNICAL_PRD.md`, `docs/ARCHITECTURE.md`, `docs/API_SPEC.md`, `docs/DATABASE_DESIGN.md`, `docs/ANTIGRAVITY_RULES.md`, `docs/UI_STYLE_GUIDE.md`, `docs/PHASES.md`).
  - Configure `.gitignore` for Node modules, environment files (`.env`), build outputs, logs, and coverage reports.
  - Set up `.env.example` in `server/` and `client/` detailing all required environment variables.
  - Configure code linting and formatting (ESLint, Prettier).
- **5. Backend work:** Initialize `server/package.json`, install baseline dependencies (`express`, `dotenv`, `cors`), configure dev scripts with hot-reloading (`nodemon`).
- **6. Frontend work:** Initialize clean Vite React template (`client/`), configure Tailwind CSS according to `UI_STYLE_GUIDE.md` (neutral color palette, Inter font), strip default boilerplates.
- **7. Database work:** Prepare MongoDB Atlas connection string template and local development fallback URI in `.env.example`.
- **8. API work:** Define root health check route skeleton (`GET /api/health`).
- **9. Security considerations:** Ensure `.env` is git-ignored; verify that secrets (DB credentials, API keys) are never committed to version control.
- **10. Testing requirements:** Verify `npm run dev` scripts work cleanly in both `server` and `client`.
- **11. Definition of Done:**
  - `server/` and `client/` packages install and run without errors.
  - Health check endpoint returns `{ status: "ok", timestamp: ... }`.
  - All documentation files are cleanly placed in `docs/`.
  - `.env.example` is complete and documented.
  - Workspace is primed for Phase 1 backend foundation.
- **12. Expected files/modules affected:**
  - `package.json` (root and subdirectories)
  - `server/package.json`, `server/.env.example`
  - `client/package.json`, `client/.env.example`, `client/vite.config.js`
  - `docs/*`
  - `.gitignore`
- **13. Important interview concepts:** Monorepo vs multi-repo trade-offs; separation of concerns between client and server; 12-factor app config management; Security best practices with `.gitignore`.
- **14. Potential risks/edge cases:** Inconsistent Node versions across development environments; ensure `engines` field is specified in `package.json`.

---

## Phase 1 --- Backend Foundation & Core Infrastructure (with MongoDB & Git Milestone)

- **Status:** COMPLETED
- **1. Objective:** Build the foundational Express application architecture, live MongoDB Atlas connection with auto-reconnection, standardized API response envelopes, centralized error handling middleware, structured logging, and execute the first verified Git repository milestone commit.
- **2. Why this phase exists:** Pairing the working MongoDB connection and the initial Git commit at the conclusion of Phase 1 ensures that the very first commit pushed to GitHub represents a tangible, verified working backend milestone with live database connectivity rather than an empty scaffold.
- **3. Prerequisites:** Phase 0 completed, MongoDB Atlas connection string ready in `server/.env`.
- **4. Features/tasks:**
  - Modular Express app setup (`server/src/app.js` and `server/src/server.js`).
  - Database connection manager with retry logic, Mongoose event listeners (`connected`, `error`, `disconnected`), and graceful shutdown hooks (`SIGINT`, `SIGTERM`).
  - Custom error hierarchy (`AppError`, `NotFoundError`, `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `ValidationError`).
  - Global error handling middleware that captures operational errors, formats consistent JSON responses (`{ success: false, message, code, ...(stack in dev) }`), and masks internal 500 errors in production.
  - Request logging using Winston/Morgan with log rotation.
  - Request validation middleware using Zod or Joi to validate `body`, `query`, and `params`.
  - Git repository initialization (`git init`), remote repository linkage (`git remote add origin ...`), and initial milestone commit.
- **5. Backend work:** Implement `server/src/config/db.js`, `server/src/middleware/errorHandler.js`, `server/src/utils/AppError.js`, `server/src/utils/apiResponse.js`, `server/src/middleware/validate.js`.
- **6. Frontend work:** None (Backend focus).
- **7. Database work:** Establish Mongoose schema conventions: strict mode enabled, timestamps (`createdAt`, `updatedAt`), custom `toJSON` transforms to remove `__v` and internal fields. Test and confirm active connection to MongoDB Atlas.
- **8. API work:**
  - `GET /api/health` (enhanced to verify live DB connection status and server uptime).
  - 404 handler for unmatched routes returning standard JSON error.
- **9. Security considerations:** Sanitize error messages in production to prevent leaking database schemas or stack traces; verify `.env` with real `MONGO_URI` is excluded before running `git add`.
- **10. Testing requirements:** Unit tests for `AppError` and `errorHandler`; integration test verifying that throwing an error produces the standard error envelope with the correct HTTP status code; live connection test to MongoDB.
- **11. Definition of Done:**
  - Express server boots and connects to MongoDB Atlas.
  - Graceful shutdown handles abrupt termination cleanly.
  - Global error handler intercepts synchronous and asynchronous errors without process crashes.
  - Consistent response envelope `{ success: true, data: ... }` and `{ success: false, message, code }` enforced.
  - Git repository initialized, remote origin linked, and first milestone commit created ("feat: backend foundation and mongodb connection").
- **12. Expected files/modules affected:**
  - `server/src/app.js`, `server/src/server.js`
  - `server/src/config/db.js`, `server/src/config/env.js`
  - `server/src/middleware/errorHandler.js`, `server/src/middleware/validate.js`
  - `server/src/utils/AppError.js`, `server/src/utils/apiResponse.js`, `server/src/utils/logger.js`
  - `.git/` (Git repository)
- **13. Important interview concepts:** Operational errors vs Programmer errors; Node.js event loop behavior during unhandled rejections; Graceful shutdown handling (`server.close()` and `mongoose.connection.close()`); Structured logging; Atomic milestone commits in professional Git workflows.
- **14. Potential risks/edge cases:** Database connection drops during runtime; unhandled asynchronous errors causing Node process death; accidentally staging `.env` file during Git initialization (prevented by Phase 0 `.gitignore`).

---

## Phase 2 --- Authentication & Authorization System

- **Status:** NOT STARTED
- **1. Objective:** Implement secure authentication and role-based access control (RBAC) using JWTs transmitted exclusively via HTTP-only, SameSite cookies, password hashing with bcrypt, and complete user profile management.
- **2. Why this phase exists:** Security starts at authentication. Storing tokens in `localStorage` exposes users to XSS token theft. Using HTTP-only cookies combined with strict backend role verification guarantees that privileged actions (e.g. admin catalog modifications) cannot be bypassed.
- **3. Prerequisites:** Phase 1 completed.
- **4. Features/tasks:**
  - User model with Mongoose: `name`, `email` (unique, lowercase), `passwordHash` (selected: false by default), `role` (`CUSTOMER` or `ADMIN`, default `CUSTOMER`), `addresses`, `wishlist`, timestamps.
  - Pre-save Mongoose hook to hash passwords using `bcrypt` (12 salt rounds) only when modified.
  - Instance method `comparePassword(candidatePassword)` on User schema.
  - JWT token generation utility with configurable expiration (`JWT_EXPIRES_IN`, e.g. 7 days).
  - Cookie helper setting `httpOnly: true`, `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'lax'` (or `'none'` if cross-domain with HTTPS).
  - Authentication middleware (`protect` / `requireAuth`): Extracts token from cookie, verifies signature, checks if user still exists in DB, checks if password changed after token was issued.
  - Authorization middleware (`restrictTo('ADMIN')`): Enforces role checks on protected routes.
  - Password reset mechanism: Cryptographically secure random token (`crypto.randomBytes`), stored as SHA256 hash with 15-minute expiration, sent via email service (Resend/Nodemailer).
- **5. Backend work:** Implement `server/src/models/User.js`, `server/src/controllers/authController.js`, `server/src/middleware/auth.js`, `server/src/routes/authRoutes.js`, `server/src/utils/email.js`.
- **6. Frontend work:** Auth context and API service for login, registration, logout, and fetching current session (`/auth/me`).
- **7. Database work:**
  - Unique index on `User.email`.
  - Schema configuration: `passwordHash` never returned in standard queries (`select: false`).
- **8. API work:**
  - `POST /api/auth/register` (Validate name, email, password; issue cookie; return sanitized user).
  - `POST /api/auth/login` (Validate credentials; issue cookie; return sanitized user).
  - `POST /api/auth/logout` (Clear cookie with matching options).
  - `GET /api/auth/me` (Protected: returns authenticated user data).
  - `POST /api/auth/forgot-password` (Generate reset token and email).
  - `POST /api/auth/reset-password` (Verify token, update password, invalidate old sessions).
- **9. Security considerations:**
  - Do NOT store plain passwords or leak password hashes in any API response.
  - Defend against timing attacks during password verification.
  - Rate limit login and registration endpoints to prevent brute-force attacks.
  - Validate email formats and enforce password complexity (minimum 8 characters, numbers, letters).
- **10. Testing requirements:**
  - Unit tests: Password hashing on save, `comparePassword` correctness.
  - Integration tests: Successful registration, duplicate email rejection (`409 Conflict`), login with valid/invalid credentials, protected route rejection with missing/invalid cookie (`401 Unauthorized`), admin route rejection for customer user (`403 Forbidden`).
- **11. Definition of Done:**
  - Registration, login, logout, and session check (`/me`) work end-to-end.
  - Passwords hashed using bcrypt; plain passwords never stored.
  - Tokens transported exclusively via HTTP-only cookies.
  - Role-based middleware blocks non-admin users from admin routes with `403 Forbidden`.
- **12. Expected files/modules affected:**
  - `server/src/models/User.js`
  - `server/src/controllers/authController.js`
  - `server/src/middleware/auth.js`
  - `server/src/routes/authRoutes.js`
  - `server/src/validators/authValidator.js`
  - `server/src/utils/jwt.js`, `server/src/utils/email.js`
- **13. Important interview concepts:** JWT vs server-side sessions; Why HTTP-only cookies prevent XSS token theft; CSRF protection mechanisms; Bcrypt work factor and salt generation; Authentication vs Authorization.
- **14. Potential risks/edge cases:** Cross-origin cookie issues between separate frontend and backend domains; clock skew on JWT expiration; user deleted while token is still active.

---

## Phase 3 --- Category & Product Management (Catalog Core & Admin CRUD)

- **Status:** NOT STARTED
- **1. Objective:** Build the category and product data models, administrative CRUD APIs, image upload integration (ImageKit / Cloudinary), and automated slug generation.
- **2. Why this phase exists:** Products are the core commodity of the platform. Admins must manage the catalog, pricing, inventory levels, and rich image galleries with strict validation before customers can browse or buy.
- **3. Prerequisites:** Phase 2 completed, ImageKit or Cloudinary credentials added to `server/.env`.
- **4. Features/tasks:**
  - Category model: `name`, `slug` (unique), `description`, `isActive`.
  - Product model: `name`, `slug` (unique), `description`, `price`, `discount` (percentage or fixed amount), `category` (ObjectId ref), `images` (array of `{ url, fileId }`), `stock` (integer, min 0), `ratingAverage` (default 0), `reviewCount` (default 0), `isActive` (boolean), timestamps.
  - Slug generation using `slugify` with collision handling for unique product URLs.
  - Admin image upload integration: `multer` for multipart memory storage and ImageKit (or Cloudinary) SDK for direct upload, transformations, and deletion of orphaned assets.
  - Admin CRUD controllers with Zod schema validation.
- **5. Backend work:** Implement `server/src/models/Category.js`, `server/src/models/Product.js`, `server/src/controllers/productController.js`, `server/src/controllers/categoryController.js`, `server/src/services/imageService.js` (ImageKit/Cloudinary provider), `server/src/routes/productRoutes.js`, `server/src/routes/categoryRoutes.js`.
- **6. Frontend work:** Admin catalog view: basic data table with product list, add/edit product modal, file upload input for images.
- **7. Database work:**
  - Indexes: Unique index on `Product.slug`, index on `Product.category`, index on `Product.createdAt`.
  - Index: Unique index on `Category.slug`.
  - Validation: Ensure `price >= 0`, `stock >= 0`, `discount >= 0`.
- **8. API work:**
  - `GET /api/categories` (Public: list active categories).
  - `POST /api/categories` (Admin only: create category).
  - `PATCH /api/categories/:id` (Admin only: update category).
  - `DELETE /api/categories/:id` (Admin only: soft-delete or disable).
  - `POST /api/products` (Admin only: create product with images).
  - `PATCH /api/products/:id` (Admin only: update product details/stock/images).
  - `DELETE /api/products/:id` (Admin only: soft-delete or delete product).
- **9. Security considerations:**
  - Validate image mime-types (JPEG, PNG, WebP only) and enforce file size limits (max 5MB) in `multer`.
  - Restrict product creation, updates, and deletes exclusively to users with `role: 'ADMIN'`.
  - Sanitize rich text/HTML descriptions to prevent stored XSS attacks.
- **10. Testing requirements:**
  - Integration tests for admin product creation with mock ImageKit/Cloudinary upload.
  - Authorization tests verifying customers receive `403 Forbidden` on `POST /api/products`.
  - Validation tests verifying negative price or stock values are rejected with `400 Bad Request`.
- **11. Definition of Done:**
  - Admins can create, update, list, and delete categories and products.
  - Images successfully upload to ImageKit/Cloudinary and return persistent URLs.
  - Slugs generate uniquely without conflicts.
  - Stock cannot be set to a negative number.
- **12. Expected files/modules affected:**
  - `server/src/models/Category.js`, `server/src/models/Product.js`
  - `server/src/controllers/categoryController.js`, `server/src/controllers/productController.js`
  - `server/src/services/imageService.js`
  - `server/src/middleware/upload.js`
  - `server/src/validators/productValidator.js`
  - `server/src/routes/categoryRoutes.js`, `server/src/routes/productRoutes.js`
- **13. Important interview concepts:** Relational referencing vs embedding in MongoDB; handling file uploads via streams vs memory storage; handling slug collisions cleanly; Image CDN lifecycle and asset management.
- **14. Potential risks/edge cases:** Orphaned images left in cloud storage if product creation fails mid-flight; deleting a category that still has active products assigned to it.

---

## Phase 4 --- Product Discovery: Search, Filter, Sort & Pagination

- **Status:** NOT STARTED
- **1. Objective:** Build high-performance public discovery APIs allowing customers to search, filter by category and price range, sort by various criteria, and paginate through product collections efficiently.
- **2. Why this phase exists:** Customers must find products quickly without causing high database load. Proper compound indexing and query construction are essential backend competencies to prevent full-collection table scans (COLLSCAN).
- **3. Prerequisites:** Phase 3 completed.
- **4. Features/tasks:**
  - Public product list API with query parameter parsing:
    - Search: Text search or regex on `name` and `description`.
    - Filter: By `category` (slug or ObjectId), price range (`minPrice`, `maxPrice`), and availability (`inStock=true`).
    - Sort: `price-asc`, `price-desc`, `newest` (`createdAt: -1`), `rating` (`ratingAverage: -1`).
    - Pagination: `page` (default 1) and `limit` (default 12, max 50).
  - Single product details API by `slug` or `id` (including populated category and review summaries).
  - Reusable query builder utility (`APIQueryFeatures` or service-level query handler).
- **5. Backend work:** Implement query filtering/sorting/pagination logic in `server/src/services/productService.js` and `server/src/controllers/productController.js`.
- **6. Frontend work:** Catalog page with search bar, category sidebar/chips, price slider, sort dropdown, product card grid, and pagination controls.
- **7. Database work:**
  - Create MongoDB text index or compound index: `{ name: 'text', description: 'text' }`.
  - Compound indexes: `{ category: 1, price: 1 }`, `{ category: 1, createdAt: -1 }`.
  - Run `.explain('executionStats')` on common queries to verify index usage and zero COLLSCANs.
- **8. API work:**
  - `GET /api/products` (Public: returns `{ products, total, totalPages, currentPage, limit }`).
  - `GET /api/products/:slug` (Public: returns product detail with populated category and rating stats).
- **9. Security considerations:**
  - Sanitize regex search strings to avoid ReDoS (Regular Expression Denial of Service) attacks.
  - Enforce strict upper bound on `limit` (e.g. max 50) to prevent memory exhaustion from `limit=1000000`.
- **10. Testing requirements:**
  - Integration tests verifying price filtering bounds (`minPrice <= price <= maxPrice`).
  - Integration tests verifying sorting orders (ascending vs descending).
  - Pagination boundary tests (`page=1`, empty page beyond total pages).
- **11. Definition of Done:**
  - Public can browse paginated catalog without authentication.
  - Search, filter by category, filter by price, and sort behave accurately together.
  - Database queries use indexes; execution metrics show index scans (`IXSCAN`).
- **12. Expected files/modules affected:**
  - `server/src/controllers/productController.js`
  - `server/src/services/productService.js`
  - `server/src/utils/apiFeatures.js`
  - `server/src/routes/productRoutes.js`
  - `server/src/validators/productQueryValidator.js`
- **13. Important interview concepts:** Offset vs Cursor-based pagination trade-offs; Compound index field order (Equality, Sort, Range - ESR rule); Full-text search in MongoDB vs Elasticsearch; Preventing ReDoS vulnerabilities.
- **14. Potential risks/edge cases:** Performance degradation with deep offset pagination (`skip(10000)`); inconsistent sort results when sorting on non-unique fields without `_id` tie-breaker.

---

## Phase 5 --- Shopping Cart Engine

- **Status:** NOT STARTED
- **1. Objective:** Build a persistent server-side shopping cart for authenticated users, enforcing real-time stock validation and authoritative server-side price calculation.
- **2. Why this phase exists:** Client-side cart totals or prices cannot be trusted. A customer could alter local storage to purchase a ₹10,000 item for ₹1. The backend must be the sole authority for pricing and product availability.
- **3. Prerequisites:** Phase 3 and Phase 4 completed.
- **4. Features/tasks:**
  - Cart model: `userId` (unique reference to User), `items: [{ productId, quantity }]`, timestamps.
  - Add to cart: Increment quantity if product exists; append new item if not.
  - Update quantity: Change quantity or remove if quantity reaches 0.
  - Remove item: Remove specific product from cart.
  - Clear cart: Empty all items in the user's cart.
  - Authoritative calculation service:
    - Fetches fresh product records from DB for all items.
    - Filters out deleted or inactive products.
    - Identifies out-of-stock items or items where requested quantity exceeds current stock.
    - Calculates `subtotal`, applicable `discount`, and `totalAmount`.
- **5. Backend work:** Implement `server/src/models/Cart.js`, `server/src/controllers/cartController.js`, `server/src/services/cartService.js`, `server/src/routes/cartRoutes.js`.
- **6. Frontend work:** Slide-out drawer or cart page showing items, thumbnail images, quantities with +/- buttons, stock warnings, authoritative total, and checkout CTA.
- **7. Database work:**
  - Unique compound index on `Cart.userId`.
  - Schema validation for `quantity >= 1`.
- **8. API work:**
  - `GET /api/cart` (Returns populated cart with live prices, available stock indicators, and calculated totals).
  - `POST /api/cart/items` (Add product and quantity).
  - `PATCH /api/cart/items/:productId` (Update quantity).
  - `DELETE /api/cart/items/:productId` (Remove item).
  - `DELETE /api/cart` (Clear entire cart).
- **9. Security considerations:**
  - Never accept price or subtotal from the client request payload.
  - Ensure a user can only access and modify their own cart (`req.user._id === cart.userId`).
  - Cap maximum item quantity per cart line item (e.g. max 10 units) to prevent artificial inventory hoarding.
- **10. Testing requirements:**
  - Integration tests for adding, updating, and removing cart items.
  - Test price tampering: Verify that passing `{ price: 1 }` in client payload is ignored and server DB price is used.
  - Test out-of-stock notification: Verify that when product stock drops below cart quantity, `GET /api/cart` flags `isAvailable: false`.
- **11. Definition of Done:**
  - Authenticated user cart persists across sessions and devices.
  - Cart reads re-fetch fresh product data and dynamically compute totals.
  - Tampered prices are impossible.
  - Cart manipulation endpoints are strictly owner-scoped.
- **12. Expected files/modules affected:**
  - `server/src/models/Cart.js`
  - `server/src/controllers/cartController.js`
  - `server/src/services/cartService.js`
  - `server/src/routes/cartRoutes.js`
  - `server/src/validators/cartValidator.js`
- **13. Important interview concepts:** Server-authoritative vs client-authoritative state; Storing minimal cart references (`productId`, `quantity`) vs full denormalized snapshots; Data consistency when prices change while in cart.
- **14. Potential risks/edge cases:** Product deleted while present in active carts; stock changes between adding to cart and visiting checkout; multiple browser tabs modifying cart simultaneously.

---

## Phase 6 --- Checkout & Inventory Reservation

- **Status:** NOT STARTED
- **1. Objective:** Build the checkout workflow with atomic multi-item inventory reservation, prevention of overselling under high concurrency, 15-minute reservation TTL expiration, and order snapshot persistence.
- **2. Why this phase exists:** This is the most critical backend reliability phase. If two users attempt to buy the last unit of a product simultaneously, a naive "read-then-update" approach causes overselling. We must guarantee atomic reservation, automatic expiration of abandoned carts, and immutable historical price/address snapshots.
- **3. Prerequisites:** Phase 5 completed.
- **4. Features/tasks:**
  - Customer shipping address validation and snapshot structure.
  - Checkout initiation endpoint:
    1. Reads user's cart and re-fetches authoritative product data.
    2. Validates that every item has sufficient stock and is active.
    3. Executes atomic inventory reservation across all items using MongoDB transactions or conditional updates:
       `Product.updateOne({ _id: item.productId, stock: { $gte: item.quantity }, isActive: true }, { $inc: { stock: -item.quantity } })`.
       If any item fails reservation due to insufficient stock, roll back already decremented items and return `409 Conflict` (`OUT_OF_STOCK`).
    4. Creates `Order` in database with:
       - `orderStatus: 'PENDING_PAYMENT'`
       - `paymentStatus: 'PENDING'`
       - `items`: Immutable snapshots containing `productId`, `productNameSnapshot`, `unitPriceSnapshot`, `quantity`, `imageSnapshot`.
       - `shippingAddressSnapshot`: Full address copy.
       - `subtotal`, `discount`, `totalAmount`.
       - `reservationExpiresAt`: Current time + 15 minutes.
  - Background reservation cleanup worker:
    - Runs periodically (e.g. every 5 minutes).
    - Queries orders where `orderStatus === 'PENDING_PAYMENT'` and `reservationExpiresAt < new Date()`.
    - Atomically cancels the order (`orderStatus: 'CANCELLED'`, `cancellationReason: 'RESERVATION_EXPIRED'`) and restores stock (`$inc: { stock: +quantity }`).
- **5. Backend work:** Implement `server/src/controllers/checkoutController.js`, `server/src/services/checkoutService.js`, `server/src/services/inventoryService.js`, `server/src/cron/reservationCleanup.js`, `server/src/models/Order.js`.
- **6. Frontend work:** Checkout screen: shipping address selection/entry form, immutable order review summary, stock error prompt, and proceed to payment button.
- **7. Database work:**
  - Indexes on `Order`: `{ userId: 1, createdAt: -1 }`, `{ orderStatus: 1, reservationExpiresAt: 1 }`.
  - Ensure `Order.items` schema embeds complete snapshot fields.
- **8. API work:**
  - `POST /api/orders` (Initiates checkout, reserves stock, creates pending order).
  - `POST /api/orders/:id/cancel` (Cancel pending checkout before payment, releases reserved stock).
- **9. Security considerations:**
  - Ensure the user cannot checkout an empty cart.
  - Verify that shipping address inputs are strictly validated against injection.
  - Protect checkout initiation with rate limiting to prevent denial-of-inventory attacks (hoarding stock via rapid pending orders).
- **10. Testing requirements:**
  - Unit tests for reservation rollback logic when a second item is out of stock.
  - Concurrency tests: Simulate 2 simultaneous checkouts requesting the same product with `stock = 1`; verify exactly 1 succeeds and 1 receives `409 Conflict`.
  - Expiration tests: Verify the cleanup job releases stock for an order past its 15-minute TTL.
- **11. Definition of Done:**
  - Pending order created with immutable snapshots of names, prices, and images.
  - Stock decremented atomically; overselling impossible under concurrent load.
  - Expired reservations automatically cancelled and stock restored.
  - Address snapshot preserved independently of user profile changes.
- **12. Expected files/modules affected:**
  - `server/src/models/Order.js`
  - `server/src/controllers/checkoutController.js`
  - `server/src/services/checkoutService.js`
  - `server/src/services/inventoryService.js`
  - `server/src/cron/reservationCleanup.js`
  - `server/src/routes/orderRoutes.js`
  - `server/src/validators/checkoutValidator.js`
- **13. Important interview concepts:** ACID transactions in MongoDB vs conditional atomic updates (`$inc` with `$gte`); Race conditions (Lost Updates, Phantom Reads); Designing for two-phase commit / reservation patterns; Mitigating denial-of-inventory attacks; Immutability of financial snapshots.
- **14. Potential risks/edge cases:** Server crash during multi-item reservation before commit; transaction timeouts on MongoDB replica sets; clock drift between app server and database.

---

## Phase 7 --- Razorpay Payment Integration & Webhook Reconciliation

- **Status:** NOT STARTED
- **1. Objective:** Integrate Razorpay payment gateway with server-side order creation in paise, cryptographic signature verification, asynchronous webhook reconciliation, and idempotent payment processing.
- **2. Why this phase exists:** Frontend payment confirmations can be faked, intercepted, or dropped due to network disconnections. The backend must verify HMAC signatures and handle webhooks idempotently so payments are recorded accurately regardless of client network failure.
- **3. Prerequisites:** Phase 6 completed.
- **4. Features/tasks:**
  - Razorpay SDK integration on the backend (`razorpay` npm package).
  - Create Razorpay Order API:
    - Takes authoritative order total from the pending order created in Phase 6.
    - Calls Razorpay Orders API (`amount` in paise, `currency: 'INR'`, `receipt: order._id.toString()`).
    - Saves `paymentOrderId` (`razorpay_order_id`) on the Order document.
  - Client Payment Verification API (`POST /api/payments/verify`):
    - Receives `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`.
    - Generates expected signature: `crypto.createHmac('sha256', KEY_SECRET).update(order_id + '|' + payment_id).digest('hex')`.
    - Compares signatures using `crypto.timingSafeEqual` to avoid timing attacks.
  - Razorpay Webhook Endpoint (`POST /api/payments/webhook`):
    - Validates `x-razorpay-signature` header using `RAZORPAY_WEBHOOK_SECRET` and raw request body.
    - Handles `payment.captured`, `payment.failed`, and `order.paid` events.
  - Centralized Idempotent Finalization Service:
    - Atomically transitions order:
      `Order.findOneAndUpdate({ razorpayOrderId, paymentStatus: { $ne: 'PAID' } }, { $set: { paymentStatus: 'PAID', orderStatus: 'CONFIRMED', paymentId: razorpay_payment_id, paidAt: new Date() } }, { new: true })`.
    - If document is updated (first execution): Clears user's cart, confirms reservation as final purchase, triggers email confirmation.
    - If document is null (already processed by webhook or client verification): Safely returns `200 OK` with existing order details.
- **5. Backend work:** Implement `server/src/services/razorpayService.js`, `server/src/controllers/paymentController.js`, `server/src/routes/paymentRoutes.js`, raw body parser middleware for webhook signature verification.
- **6. Frontend work:** Integrate Razorpay `Checkout.js` script; handle payment modal response, pass verification payload to backend, display loading and success screens.
- **7. Database work:**
  - Index: `Order.paymentOrderId` (Razorpay order ID).
  - Index: `Order.paymentId` (Razorpay payment ID).
- **8. API work:**
  - `POST /api/payments/create-order` (Initiates Razorpay order for pending internal order).
  - `POST /api/payments/verify` (Validates client payment signature and confirms order).
  - `POST /api/payments/webhook` (Public webhook receiver with raw signature verification).
- **9. Security considerations:**
  - `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` must remain strictly server-side.
  - Express must capture the raw unparsed body for the webhook endpoint to prevent HMAC signature validation mismatches.
  - Use `crypto.timingSafeEqual` for signature comparisons.
  - Never trust client-sent amounts; amount must come directly from backend order record.
- **10. Testing requirements:**
  - Unit tests for HMAC signature verification logic with valid and invalid signatures.
  - Idempotency test: Call `confirmOrderPayment` twice concurrently with identical payment IDs; verify order is updated once and cart is cleared once.
  - Webhook test: Simulate `payment.captured` event payload with valid HMAC header.
- **11. Definition of Done:**
  - Razorpay checkout opens with exact server-calculated amount in paise.
  - Client signature verification confirms order and clears cart.
  - Razorpay webhooks process asynchronously and idempotently.
  - Duplicate webhook delivery does not cause duplicate processing or corrupted state.
- **12. Expected files/modules affected:**
  - `server/src/services/razorpayService.js`
  - `server/src/controllers/paymentController.js`
  - `server/src/routes/paymentRoutes.js`
  - `server/src/app.js` (raw body configuration for webhook)
  - `server/src/validators/paymentValidator.js`
- **13. Important interview concepts:** Payment Gateway integration flow; Webhook verification vs client-side callbacks; Idempotency keys and distributed state consistency; Avoiding timing attacks via `timingSafeEqual`; Handling network partitions during financial transactions.
- **14. Potential risks/edge cases:** Webhook arriving before client callback or vice versa; webhook signature mismatch due to JSON body parsing middleware; user abandoning checkout modal after Razorpay order creation.

---

## Phase 8 --- Order Lifecycle & Cancellation Management

- **Status:** NOT STARTED
- **1. Objective:** Implement complete order state machine (`PENDING_PAYMENT → CONFIRMED → SHIPPED → DELIVERED` and `CANCELLED`), order tracking, user order history, and safe cancellation with stock restitution.
- **2. Why this phase exists:** E-commerce operations require clear transitions. Customers need to track packages and cancel eligible orders; admins need to update fulfillment status; inventory must be accurately restocked if an order is cancelled.
- **3. Prerequisites:** Phase 7 completed.
- **4. Features/tasks:**
  - Order state machine validation:
    - Allowed customer cancellations: Only in `PENDING_PAYMENT` or `CONFIRMED` states (before shipping).
    - Allowed admin transitions: `CONFIRMED → SHIPPED`, `SHIPPED → DELIVERED`.
    - Terminal states: `DELIVERED`, `CANCELLED`, `PAYMENT_FAILED`.
  - Customer order cancellation workflow:
    - Validates order ownership.
    - Transitions `orderStatus` to `CANCELLED`.
    - Atomically increments stock back to products:
      `Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } })`.
    - Initiates payment refund process (via Razorpay API or marks as `REFUND_PENDING` for manual processing).
  - Customer order listing with pagination and status filtering.
  - Order detail view with item snapshots, tracking information, and status timeline.
- **5. Backend work:** Implement `server/src/controllers/orderController.js`, `server/src/services/orderService.js`, `server/src/routes/orderRoutes.js`.
- **6. Frontend work:** Orders history page, order details page with interactive status stepper (`Confirmed → Shipped → Delivered`), cancellation confirmation modal.
- **7. Database work:**
  - Compound indexes on `Order`: `{ userId: 1, createdAt: -1 }`, `{ orderStatus: 1 }`.
- **8. API work:**
  - `GET /api/orders` (Customer: list my orders with pagination).
  - `GET /api/orders/:id` (Customer: get my order details; Admin: get any order).
  - `POST /api/orders/:id/cancel` (Customer/Admin: cancel order and restock inventory).
- **9. Security considerations:**
  - Strict resource ownership verification: Verify `order.userId.toString() === req.user._id.toString()` unless caller is `ADMIN`.
  - Prevent state transition bypass: Disallow cancelling an order once status has transitioned to `SHIPPED` or `DELIVERED`.
- **10. Testing requirements:**
  - Integration test: Customer cancels confirmed order -> verify `orderStatus` is `CANCELLED` and product stock increases by exact ordered quantity.
  - Unauthorized access test: User A attempts `GET /api/orders/:id` for User B's order -> verify `403 Forbidden` or `404 Not Found`.
  - State machine test: Attempt to cancel a `SHIPPED` order -> verify `400 Bad Request`.
- **11. Definition of Done:**
  - Customers can view paginated order history and detailed tracking.
  - Valid cancellations immediately restock products atomically.
  - Invalid state transitions are blocked by business rule validation.
  - Unauthorized access between customers is impossible.
- **12. Expected files/modules affected:**
  - `server/src/models/Order.js`
  - `server/src/controllers/orderController.js`
  - `server/src/services/orderService.js`
  - `server/src/routes/orderRoutes.js`
  - `server/src/validators/orderValidator.js`
- **13. Important interview concepts:** Finite State Machines (FSM) in software design; Idempotent cancellation and stock restitution; Authorization checks on data resources (IDOR - Insecure Direct Object Reference prevention); Refund handling strategies.
- **14. Potential risks/edge cases:** Customer cancelling while admin is simultaneously marking order as shipped; partial refunds if multiple items are cancelled.

---

## Phase 9 --- Customer Reviews & Wishlist

- **Status:** NOT STARTED
- **1. Objective:** Implement customer product reviews restricted strictly to verified buyers of delivered orders, automated recalculation of product ratings, and customer wishlist management.
- **2. Why this phase exists:** Fake reviews destroy customer trust. Restricting reviews to verified purchasers who actually received the product (`DELIVERED` status) proves high data integrity. Wishlists enhance customer retention and discovery.
- **3. Prerequisites:** Phase 8 completed.
- **4. Features/tasks:**
  - Review model: `userId`, `productId`, `orderId`, `rating` (1 to 5 stars), `comment`, timestamps.
  - Verified buyer verification rule:
    - To review product X, the user must possess an order with `userId === req.user._id`, `orderStatus === 'DELIVERED'`, and `items.productId === X`.
  - Review uniqueness: One review per customer per product (enforced by unique compound index).
  - Atomic rating recalculation:
    - MongoDB aggregation pipeline calculates `averageRating` and `reviewCount`.
    - Updates target `Product` document atomically.
  - Wishlist management:
    - User wishlist array of product references.
    - Add to wishlist, remove from wishlist, and "Move item to cart" workflow.
- **5. Backend work:** Implement `server/src/models/Review.js`, `server/src/controllers/reviewController.js`, `server/src/controllers/wishlistController.js`, `server/src/routes/reviewRoutes.js`, `server/src/routes/wishlistRoutes.js`.
- **6. Frontend work:** Reviews list on product details page, "Write a Review" modal (shown only if eligible), star rating component, customer wishlist page with "Move to Cart" button.
- **7. Database work:**
  - Unique compound index: `{ userId: 1, productId: 1 }` on Review.
  - Index: `Review.productId`.
  - Static method on Review model: `Review.calcAverageRatings(productId)`.
- **8. API work:**
  - `GET /api/products/:id/reviews` (Public: list reviews with pagination).
  - `POST /api/products/:id/reviews` (Authenticated: create review if verified purchaser).
  - `DELETE /api/reviews/:id` (Authenticated: owner or admin delete review).
  - `GET /api/wishlist` (Customer: list wishlist items).
  - `POST /api/wishlist/:productId` (Customer: add to wishlist).
  - `DELETE /api/wishlist/:productId` (Customer: remove from wishlist).
  - `POST /api/wishlist/:productId/move-to-cart` (Customer: transfer item to cart).
- **9. Security considerations:**
  - Sanitize review comments against XSS before storage.
  - Prevent unauthorized review deletion: Only the author or an `ADMIN` may delete.
  - Strict validation of rating value (`1 <= rating <= 5`, integer only).
- **10. Testing requirements:**
  - Test verified purchaser gating: User who has NOT bought the product receives `403 Forbidden` on review submission.
  - Test duplicate review rejection: Submitting a second review for the same product returns `409 Conflict`.
  - Test rating average: Creating a 5-star and a 3-star review updates `ratingAverage` to 4.0 and `reviewCount` to 2 on the Product model.
- **11. Definition of Done:**
  - Reviews strictly gated to customers with delivered orders.
  - Product rating average and review count update automatically on create/delete.
  - Wishlist persists and supports seamless transfer to cart.
- **12. Expected files/modules affected:**
  - `server/src/models/Review.js`, `server/src/models/User.js`
  - `server/src/controllers/reviewController.js`, `server/src/controllers/wishlistController.js`
  - `server/src/routes/reviewRoutes.js`, `server/src/routes/wishlistRoutes.js`
  - `server/src/validators/reviewValidator.js`
- **13. Important interview concepts:** Aggregation pipelines in MongoDB (`$match`, `$group`); Triggering denormalized data updates via post-save hooks; Compound unique constraints; Verified buyer validation patterns.
- **14. Potential risks/edge cases:** Recalculating averages on high-volume products during high concurrency; ensuring review deletion properly updates product rating averages.

---

## Phase 10 --- Admin Dashboard & Operational Metrics

- **Status:** NOT STARTED
- **1. Objective:** Build administrative operational dashboard APIs providing key sales metrics, order fulfillment management, inventory threshold alerts, and customer administration.
- **2. Why this phase exists:** Store operators require visibility into business performance, low-stock alerts, and streamlined order fulfillment tools to ship products promptly.
- **3. Prerequisites:** Phase 8 and Phase 9 completed.
- **4. Features/tasks:**
  - Admin Dashboard Metrics API (`GET /api/admin/dashboard`):
    - Total gross revenue (aggregated from `PAID` orders).
    - Total order count broken down by status (`PENDING`, `CONFIRMED`, `SHIPPED`, `DELIVERED`, `CANCELLED`).
    - Low stock inventory alert count (`stock <= 5`).
    - Total registered customers count.
    - Recent 5 orders overview.
  - Admin Order Management API:
    - List all orders with filters (status, date range, customer email) and pagination.
    - Status update endpoint: Transition order to `SHIPPED` (with optional tracking number) or `DELIVERED`.
  - Admin Customer Management API:
    - List registered customers with order counts and registration dates.
- **5. Backend work:** Implement `server/src/controllers/adminController.js`, `server/src/services/adminService.js`, `server/src/routes/adminRoutes.js`.
- **6. Frontend work:** Admin dashboard layout with KPI summary cards (Revenue, Orders, Low Stock, Users), recent orders table, fulfillment status dropdowns, and low-stock indicator badges.
- **7. Database work:**
  - MongoDB aggregation pipelines using `$facet` to calculate multiple dashboard metrics in a single database round-trip.
  - Index verification on `Order.orderStatus` and `Order.createdAt`.
- **8. API work:**
  - `GET /api/admin/dashboard` (Admin only: summary KPI metrics).
  - `GET /api/admin/orders` (Admin only: all orders with filters and pagination).
  - `PATCH /api/admin/orders/:id/status` (Admin only: transition order status).
  - `GET /api/admin/users` (Admin only: list registered customers).
- **9. Security considerations:**
  - Enforce `protect` and `restrictTo('ADMIN')` on all `/api/admin/*` endpoints.
  - Never allow non-admin callers to view customer lists or overall financial revenue numbers.
- **10. Testing requirements:**
  - Unit tests for admin aggregation calculations.
  - Authorization tests: Verify customer token calling `/api/admin/dashboard` receives `403 Forbidden`.
  - Status transition tests: Ensure admin can advance `CONFIRMED` to `SHIPPED`.
- **11. Definition of Done:**
  - Dashboard returns accurate aggregated revenue, order stats, and low-stock alerts.
  - Admin can filter, inspect, and update fulfillment states of all store orders.
  - All admin endpoints strictly protected against unauthorized access.
- **12. Expected files/modules affected:**
  - `server/src/controllers/adminController.js`
  - `server/src/services/adminService.js`
  - `server/src/routes/adminRoutes.js`
  - `server/src/validators/adminValidator.js`
- **13. Important interview concepts:** MongoDB `$facet` and aggregation performance; Designing operational dashboards without overloading primary databases; Real-time vs pre-computed analytics.
- **14. Potential risks/edge cases:** Aggregation performance degrading as order collection scales past hundreds of thousands of documents; handling status updates for already-cancelled orders.

---

## Phase 11 --- Frontend Application Integration & UX Polish

- **Status:** NOT STARTED
- **1. Objective:** Build a clean, responsive, trustworthy frontend using React and Vite, implementing the palette and typography defined in `UI_STYLE_GUIDE.md` (`#1F3A5F` Deep Slate Blue, `#F7F7F5` Warm Off-White, Inter font), complete with Razorpay checkout modal integration and comprehensive loading/error states.
- **2. Why this phase exists:** A backend platform needs an intuitive, professional user interface to demonstrate end-to-end viability. Per project requirements, the UI avoids decorative fluff (no AI gradients, no glassmorphism, no neon) and prioritizes functional clarity, accessibility, and reliability.
- **3. Prerequisites:** Phases 1 through 10 completed.
- **4. Features/tasks:**
  - Design system configuration in Tailwind CSS matching `UI_STYLE_GUIDE.md`:
    - Primary: `#1F3A5F` (Deep Slate Blue)
    - Background: `#F7F7F5` (Warm Off-White)
    - Surface: `#FFFFFF`
    - Text: `#17202A` (Charcoal)
    - Muted: `#667085`
    - Border: `#E5E7EB`
    - Success: `#2F6B4F`
    - Danger: `#B54747`
    - Font: Inter
  - Core layouts: Customer Navbar (Logo, search bar, category navigation, cart count badge, user profile menu), responsive Footer, Admin sidebar navigation.
  - Customer Pages:
    - Home / Catalog page with search, filters, sorting, and pagination.
    - Product Details page with image gallery, stock badge, quantity picker, add-to-cart, wishlist toggle, and verified buyer reviews.
    - Cart slide-out drawer and full cart page.
    - Checkout page with address selection, order summary, and Razorpay modal integration.
    - Order Confirmation page with order summary and receipt details.
    - Order History & Tracking page with status timeline stepper.
    - Wishlist page.
    - Auth pages (Login, Register, Forgot Password).
  - Admin Pages:
    - Overview Dashboard with KPI summary cards and recent activity.
    - Product Management (Data table with image thumbnails, stock levels, add/edit modal).
    - Order Fulfillment (Order list with status update actions and customer details).
  - Universal UX states:
    - Skeleton loaders for cards, tables, and details.
    - Empty states ("No products found", "Your cart is empty", "No orders yet").
    - Error banners and toast notifications.
    - Disabled buttons during network submission with loading spinners.
- **5. Backend work:** Ensure CORS allows frontend origin with credentials enabled.
- **6. Frontend work:** Implement components in `client/src/components/`, `client/src/pages/`, `client/src/context/`, `client/src/services/api.js`.
- **7. Database work:** None.
- **8. API work:** Verify all frontend API calls pass cookies (`withCredentials: true`) and handle standardized error responses (`error.response.data.message`).
- **9. Security considerations:**
  - Never store JWTs or sensitive user roles in `localStorage` or `sessionStorage`.
  - Escape all rendered user-generated content to prevent cross-site scripting (XSS).
  - Handle expired sessions gracefully (redirect to login with return URL).
- **10. Testing requirements:**
  - Cross-browser verification of the checkout flow.
  - Responsive layout verification across mobile (375px), tablet (768px), and desktop (1280px).
  - Accessibility check (keyboard tab navigation, ARIA labels on icon buttons).
- **11. Definition of Done:**
  - Complete customer journey executable from browser: Register → Browse → Add to Cart → Checkout → Pay via Razorpay modal → View confirmed order.
  - Admin can manage products, upload images, and update order fulfillment status from browser.
  - Visual styling strictly complies with `UI_STYLE_GUIDE.md`.
- **12. Expected files/modules affected:**
  - `client/src/App.jsx`, `client/src/main.jsx`
  - `client/src/context/AuthContext.jsx`, `client/src/context/CartContext.jsx`
  - `client/src/pages/*`
  - `client/src/components/*`
  - `client/src/services/api.js`
  - `client/tailwind.config.js`
- **13. Important interview concepts:** State management patterns (React Context vs external stores); Handling credentialed cross-origin HTTP cookies; Optimistic UI updates vs server-authoritative rendering; Web accessibility (WCAG) guidelines.
- **14. Potential risks/edge cases:** Razorpay script failing to load due to ad-blockers; network disconnection during payment modal submission.

---

## Phase 12 --- Comprehensive Automated Testing & Concurrency Verification

- **Status:** NOT STARTED
- **1. Objective:** Build an automated test suite covering unit logic, API integration endpoints, and high-concurrency race condition scenarios (preventing overselling and duplicate payment processing).
- **2. Why this phase exists:** To prove that ShopSphere is production-grade and interview-ready. Writing automated concurrency tests that simulate multiple simultaneous checkouts for the last available item conclusively proves backend engineering depth.
- **3. Prerequisites:** Phases 1 through 11 completed.
- **4. Features/tasks:**
  - Test runner setup with Jest or Vitest + Supertest + MongoMemoryServer.
  - Unit Tests:
    - Password hashing and verification utilities.
    - JWT signing and verification.
    - Cart price calculation and discount algorithms.
    - Zod/Joi validation schemas.
  - Integration Tests:
    - Authentication suite (Register, login, cookie setting, protected route authorization).
    - Catalog suite (Admin product CRUD, public search/filter/pagination).
    - Cart suite (Add, update quantity, remove, owner verification).
    - Order suite (Pending order creation, snapshots, state machine transitions).
  - High-Concurrency Tests (The "Placement Proof"):
    - Create a product with `stock = 3`.
    - Fire 10 simultaneous checkout requests across 10 distinct user sessions.
    - Verify that exactly 3 requests succeed (`201 Created` or `200 OK`) and 7 requests fail with `409 Conflict` (`OUT_OF_STOCK`).
    - Verify that final product stock in database is exactly 0 (never negative).
  - Payment Idempotency Tests:
    - Fire concurrent verification and webhook requests with identical payment IDs; verify order transitions to `PAID` once and cart is emptied once.
- **5. Backend work:** Implement test files in `server/tests/unit/`, `server/tests/integration/`, `server/tests/concurrency/`.
- **6. Frontend work:** None (Backend verification priority).
- **7. Database work:** Use in-memory MongoDB or isolated test database with automated setup and teardown fixtures.
- **8. API work:** None (testing existing endpoints).
- **9. Security considerations:** Ensure test environment uses mock credentials and never connects to production third-party APIs.
- **10. Testing requirements:** Run `npm test` across all suites; generate code coverage reports targetting >80% on critical business services.
- **11. Definition of Done:**
  - All unit, integration, and concurrency tests pass deterministically without flaky failures.
  - Concurrency test conclusively demonstrates zero overselling and non-negative inventory.
  - Automated CI test script runs successfully.
- **12. Expected files/modules affected:**
  - `server/tests/setup.js`
  - `server/tests/unit/*`
  - `server/tests/integration/*`
  - `server/tests/concurrency/inventoryConcurrency.test.js`
  - `server/tests/concurrency/paymentIdempotency.test.js`
  - `server/package.json`
- **13. Important interview concepts:** Testing asynchronous concurrency; Simulating race conditions with `Promise.all`; In-memory database mocking vs real container integration; Writing deterministic tests.
- **14. Potential risks/edge cases:** Flaky tests caused by timeout issues on busy CI runners; unhandled open handles preventing Jest from exiting cleanly.

---

## Phase 13 --- Security Hardening & Performance Optimization

- **Status:** NOT STARTED
- **1. Objective:** Harden the application against common web vulnerabilities (OWASP Top 10), enforce strict rate limiting, configure security headers, sanitize inputs, and profile database query performance.
- **2. Why this phase exists:** E-commerce systems are prime targets for attacks (credential stuffing, carding attacks, inventory exhaustion). Hardening security and eliminating slow queries is essential for production readiness.
- **3. Prerequisites:** Phase 12 completed.
- **4. Features/tasks:**
  - Security headers configuration using `helmet` (Content Security Policy, X-Content-Type-Options, Strict-Transport-Security).
  - Granular Rate Limiting with `express-rate-limit`:
    - General API limiter (e.g. 100 requests per 15 minutes).
    - Strict Auth limiter for `/api/auth/login` and `/api/auth/register` (e.g. 5 requests per 15 minutes to thwart brute force).
    - Strict Checkout limiter for `/api/orders` (to thwart inventory hoarding bots).
  - Injection Defense:
    - Sanitize MongoDB queries against NoSQL operator injection (`$gt`, `$ne`).
    - Input sanitization against XSS in user-submitted strings.
  - CORS Configuration:
    - Restrict allowed origins strictly to the deployed frontend domain with `credentials: true`.
  - Database Performance Profiling:
    - Inspect slow query logs.
    - Run `.explain()` on all search and discovery queries to confirm compound index utilization.
    - Optimize Mongoose queries with `.lean()` on read-only operations.
- **5. Backend work:** Implement `server/src/middleware/rateLimiter.js`, `server/src/middleware/security.js`, update `server/src/app.js`.
- **6. Frontend work:** Configure secure Axios/fetch interceptor handling 429 Rate Limited responses with polite retry notices.
- **7. Database work:** Review and create any missing compound indexes identified during profiling.
- **8. API work:** Standardize 429 Too Many Requests response payload.
- **9. Security considerations:**
  - Never disclose server versions in headers (`x-powered-by: Express` disabled).
  - Ensure secrets are loaded solely from environment variables and never logged.
- **10. Testing requirements:**
  - Automated test verifying rate limit kicks in after N failed login attempts with `429 Too Many Requests`.
  - Test verifying NoSQL query injection payload (e.g. `{ "email": { "$gt": "" } }`) is sanitized and rejected.
- **11. Definition of Done:**
  - Helmet headers present on all HTTP responses.
  - Rate limiting protects auth and checkout endpoints.
  - NoSQL injection vectors sanitized.
  - Read-heavy queries use indexes with verified execution times under 20ms.
- **12. Expected files/modules affected:**
  - `server/src/app.js`
  - `server/src/middleware/rateLimiter.js`
  - `server/src/middleware/security.js`
  - `server/src/services/productService.js` (lean queries)
- **13. Important interview concepts:** OWASP Top 10 vulnerabilities; NoSQL injection mechanisms; Leaky Bucket / Token Bucket rate limiting algorithms; Database query optimization and index cardinality.
- **14. Potential risks/edge cases:** Rate limiter blocking legitimate users behind shared corporate NATs/proxies (mitigated by configuring `trust proxy` correctly).

---

## Phase 14 --- Production Deployment & CI/CD

- **Status:** NOT STARTED
- **1. Objective:** Deploy the complete ShopSphere platform to production infrastructure: Backend on Render, Frontend on Vercel, Database on MongoDB Atlas, with environment isolation and automated health monitoring.
- **2. Why this phase exists:** A project is not complete until it runs reliably in a real production environment with public HTTPS URLs, cross-domain cookie handling, and production database clusters.
- **3. Prerequisites:** Phase 13 completed.
- **4. Features/tasks:**
  - MongoDB Atlas production cluster configuration:
    - Network access rules (IP whitelisting or 0.0.0.0/0 with strong authentication).
    - Dedicated database user with restricted permissions.
  - Backend deployment to Render:
    - Configure Web Service with Node environment (`NODE_ENV=production`).
    - Add environment variables (`PORT`, `MONGO_URI`, `JWT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `CLOUDINARY_*`, `CLIENT_URL`).
    - Configure health check path (`/api/health`).
  - Frontend deployment to Vercel:
    - Configure build command (`npm run build`) and output directory (`dist`).
    - Set environment variable (`VITE_API_URL` pointing to Render HTTPS backend).
    - Configure rewrite rules for client-side routing in `vercel.json`.
  - Cross-Domain Production Cookie Setup:
    - Set cookie flags: `sameSite: 'none'`, `secure: true`, `domain: ...` if applicable.
    - Set CORS: `origin: process.env.CLIENT_URL`, `credentials: true`.
  - GitHub Actions CI pipeline:
    - Automated linting and test execution on every pull request to `main`.
- **5. Backend work:** Implement `render.yaml` or Render configuration, update production cookie policies, configure `trust proxy` on Express.
- **6. Frontend work:** Create `client/vercel.json` for single-page app routing rewrites, configure production API base URL.
- **7. Database work:** Execute production index creation script on MongoDB Atlas.
- **8. API work:** Verify `/api/health` returns status, uptime, and database connectivity.
- **9. Security considerations:**
  - Production cookies MUST have `secure: true` (only transmitted over HTTPS).
  - Use separate Razorpay and Cloudinary keys for production versus local development.
- **10. Testing requirements:**
  - Live smoke test: Register new customer, browse catalog, add item to cart, complete real/test checkout, verify order in admin portal on production URLs.
  - Verify cookies set properly cross-domain in Google Chrome, Safari, and Firefox.
- **11. Definition of Done:**
  - Frontend live on Vercel with HTTPS.
  - Backend live on Render with HTTPS.
  - Database connected to MongoDB Atlas.
  - End-to-end checkout and payment flow functional on production domains.
- **12. Expected files/modules affected:**
  - `.github/workflows/ci.yml`
  - `client/vercel.json`
  - `server/src/app.js`
  - `server/src/config/env.js`
- **13. Important interview concepts:** Cross-origin resource sharing (CORS) with credentials; Third-party cookie deprecation and SameSite attributes; Continuous Integration / Continuous Deployment (CI/CD) pipelines; Health check probe designs.
- **14. Potential risks/edge cases:** Safari blocking cross-domain third-party cookies; Render free-tier instance cold starts; CORS pre-flight `OPTIONS` caching.

---

## Phase 15 --- Final Documentation & Interview Preparation

- **Status:** NOT STARTED
- **1. Objective:** Consolidate comprehensive project documentation, create system architecture and database ER diagrams, and assemble an engineering interview cheat-sheet detailing all technical trade-offs.
- **2. Why this phase exists:** ShopSphere is built primarily as an SDE placement vehicle. The candidate must be able to articulate every architectural decision, concurrency strategy, security measure, and database indexing choice during technical interviews.
- **3. Prerequisites:** Phase 14 completed.
- **4. Features/tasks:**
  - High-quality `README.md` with:
    - Project overview, core problem statement, and live deployment links.
    - Architecture diagram and checkout flow state machine.
    - Tech stack summary with design justifications.
    - Local setup and development instructions.
    - API endpoint summary table.
  - Technical deep-dive document (`docs/INTERVIEW_CHEATSHEET.md`):
    - Concurrency & Race Condition Prevention: Explaining atomic `$inc` with `$gte` vs distributed locking.
    - Payment Idempotency: Explaining dual-path client verification + webhook reconciliation.
    - Authentication Strategy: Explaining JWT in HTTP-only cookies vs Bearer tokens in localStorage.
    - Database Modeling: Explaining denormalized order snapshots vs real-time referencing.
    - Indexing Strategy: Explaining compound index field ordering (ESR rule).
  - Verified User Journey walkthrough document with test execution outputs.
- **5. Backend work:** None.
- **6. Frontend work:** None.
- **7. Database work:** Generate final schema diagram and ER documentation.
- **8. API work:** Validate API documentation against actual routes.
- **9. Security considerations:** Ensure no real API keys, secrets, or internal server IPs are included in documentation.
- **10. Testing requirements:** Review all documentation against running application to ensure 100% accuracy.
- **11. Definition of Done:**
  - `README.md` is complete, professional, and visually clear.
  - `docs/INTERVIEW_CHEATSHEET.md` equips the candidate with crisp answers for technical interviews.
  - All features from PRD are accounted for and documented.
- **12. Expected files/modules affected:**
  - `README.md`
  - `docs/INTERVIEW_CHEATSHEET.md`
  - `docs/ARCHITECTURE.md` (updates)
- **13. Important interview concepts:** Articulating engineering trade-offs; Explaining system bottlenecks and future scalability (Redis caching, message queues, read replicas); Demonstrating software craftsmanship and ownership.
- **14. Potential risks/edge cases:** Stale documentation that deviates from implemented code; ensure documentation matches active codebase.
