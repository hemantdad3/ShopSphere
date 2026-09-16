# ShopSphere

> **A Production-Grade, Resilient Single-Vendor E-Commerce Platform**  
> Built with Node.js, Express, MongoDB Atlas, and React 18 / Vite. Engineered specifically to demonstrate backend concurrency correctness, payment idempotency, zero-trust server validation, and finite state machine lifecycle management.

[![CI Pipeline](https://github.com/hemantdad3/ShopSphere/actions/workflows/ci.yml/badge.svg)](https://github.com/hemantdad3/ShopSphere/actions)
[![Automated Tests](https://img.shields.io/badge/tests-417%20passed-brightgreen.svg)](https://github.com/hemantdad3/ShopSphere)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-blue.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 1. System Architecture & Topology

```
┌─────────────────────────────────────────────────────────────┐
│                 React 18 SPA (Vite / Vercel)                │
│    - Slide-out Cart Drawer    - Filter/Sort/Search Engine   │
│    - Razorpay Checkout Modal  - Admin Analytics Portal      │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / REST (Cross-Domain Cookies)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Express API Server (Render)                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Security Layer: Helmet CSP, HSTS, Rate Limiters,      │  │
│  │ NoSQL Operator Sanitizer, XSS Defense                 │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Business Logic: Zod Validation, Authoritative Cart    │  │
│  │ Calculation, Order FSM, ImageKit Media Adapter        │  │
│  └───────────────────────────┬───────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
┌──────────────────────┐ ┌─────────────┐ ┌────────────────────┐
│ MongoDB Atlas Cluster│ │  Razorpay   │ │  ImageKit.io CDN   │
│  - Replica Set       │ │   Gateway   │ │  - Cloud Media &   │
│  - Compound ESR Idxs │ │  (Webhooks) │ │    Optimizations   │
└──────────────────────┘ └─────────────┘ └────────────────────┘
```

---

## 2. Core Engineering Highlights

### ⚡ Zero-Overselling Atomic Concurrency
- Uses MongoDB conditional atomic updates (`$inc: -qty` with query predicate `stock: { $gte: qty }`) at the storage engine level.
- Eliminates classic Time-of-Check to Time-of-Use (TOCTOU) race conditions.
- **Formally proven** in high-concurrency automated tests: 10 concurrent checkouts competing for 3 units resulted in strictly 3 orders confirmed, 7 conflicts (`HTTP 409`), and exact zero residual overselling.

### 🔒 Payment Idempotency & Dual-Channel Reconciliation
- Handles simultaneous verification requests from browser client callbacks and asynchronous Razorpay webhooks.
- Uses HMAC SHA-256 cryptographic signature validation and atomic conditional status acquisition (`findOneAndUpdate({ paymentStatus: { $ne: 'PAID' } })`) to guarantee zero duplicate fulfillments.

### 🛡️ Defense-in-Depth Security (OWASP Top 10)
- **Helmet:** Content Security Policy (CSP), HTTP Strict Transport Security (HSTS 1 yr), `nosniff`, `x-powered-by` suppression.
- **Rate Limiting:** Granular sliding-window limiters protecting general APIs (300 req/15m), authentication endpoints (10 req/15m), and checkout routes (20 req/15m).
- **Sanitization:** Recursive stripping of NoSQL query operators (`$gt`, `$ne`, `$regex`) and cross-site scripting (`<script>`) tags.

### 🔄 Order Finite State Machine (FSM)
- Governs order transitions: `PENDING_PAYMENT` ➔ `CONFIRMED` ➔ `PROCESSING` ➔ `SHIPPED` ➔ `DELIVERED`.
- Enforces automatic inventory restock and refund dispatch when an order is cancelled from any active state.

---

## 3. Technology Stack

| Domain | Technology | Justification |
| :--- | :--- | :--- |
| **Backend** | Node.js (v18+) & Express.js | Non-blocking asynchronous I/O with modular controller-service-repository architecture. |
| **Database** | MongoDB Atlas (M0 Multi-Shard Cluster) | Document model allows atomic single-document mutations and embedded line item snapshots. |
| **Frontend** | React 18 + Vite + Tailwind CSS v4 | High performance single-page application with modern micro-interactions and atomic styling. |
| **Payments** | Razorpay (Test / Live Mode) | Industry-standard payment gateway supporting Cards, UPI, Netbanking with server HMAC signatures. |
| **Validation** | Zod | Runtime schema validation and boundary sanitization on incoming HTTP payloads. |
| **Security** | Helmet + Express-Rate-Limit | Header security compliance and sliding window rate limiting. |

---

## 4. Getting Started Locally

### Prerequisites
- Node.js `>= 18.0.0`
- Git
- MongoDB Atlas account (or local MongoDB daemon)

### 1. Clone the Repository
```bash
git clone https://github.com/hemantdad3/ShopSphere.git
cd ShopSphere
```

### 2. Configure Environment Variables
Create `.env` inside `server/`:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/shopsphere?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_development_jwt_key_here_min_32_chars
JWT_EXPIRES_IN=7d
JWT_COOKIE_EXPIRES_IN=7
CLIENT_URL=http://localhost:5173
RAZORPAY_KEY_ID=rzp_test_placeholder
RAZORPAY_KEY_SECRET=placeholder_secret
RAZORPAY_WEBHOOK_SECRET=placeholder_webhook_secret
```

Create `.env` inside `client/`:
```env
VITE_API_URL=http://localhost:5000/api
```

### 3. Install Dependencies
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 4. Run Development Servers
```bash
# In terminal 1 (Server):
cd server
npm run dev

# In terminal 2 (Client):
cd client
npm run dev
```

The frontend SPA will be available at `http://localhost:5173` and the backend API at `http://localhost:5000`.

---

## 5. Automated Testing & Verification

ShopSphere includes a comprehensive automated test suite with **417 passing assertions** and **0 failures** across 13 dedicated test runners:

```bash
# Run all unit, integration, concurrency, and security test suites
cd server
npm run test:all
```

### Test Suite Summary:
- `npm run test:unit`: Mathematical calculations (cart totals, paise conversions, Zod schemas, sanitizers).
- `node tests/authVerification.js`: User registration, bcrypt hashing, JWT cookie issuance, RBAC.
- `node tests/catalogVerification.js`: Product creation, category hierarchies, slugification, image uploads.
- `node tests/discoveryVerification.js`: Full-text search, multi-facet filtering, compound IXSCAN queries.
- `node tests/cartVerification.js`: Authoritative server calculations, quantity bounds, cart mutations.
- `node tests/checkoutVerification.js`: Atomic inventory decrements, 15-minute reservation expirations.
- `node tests/paymentVerification.js`: Razorpay signature verification and HMAC webhook validation.
- `node tests/orderVerification.js`: Finite state machine transitions, cancellation, and stock restock.
- `node tests/reviewsVerification.js`: Verified buyer check, 1-review-per-customer constraint, average rating updates.
- `node tests/adminVerification.js`: High-speed MongoDB `$facet` aggregations and low-stock alerts.
- `node tests/inventoryConcurrency.test.js`: Multi-client concurrent checkout race condition verification.
- `node tests/paymentIdempotency.test.js`: Dual-path race condition idempotency lock verification.
- `node tests/securityVerification.js`: OWASP Top 10 hardening, NoSQL injection rejection, rate limiters.

---

## 6. Key API Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/auth/register` | Public | Register new customer account |
| `POST` | `/api/auth/login` | Public | Authenticate user & issue HTTP-only JWT cookie |
| `POST` | `/api/auth/logout` | Authenticated | Invalidate session cookie |
| `GET` | `/api/products` | Public | Search, filter, and paginate products (`.lean()` optimized) |
| `GET` | `/api/cart` | Authenticated | Fetch authoritative cart with server-side pricing |
| `POST` | `/api/cart` | Authenticated | Add item to cart with authoritative stock check |
| `POST` | `/api/orders/checkout` | Authenticated | Atomic inventory reservation & order initialization |
| `POST` | `/api/payments/verify` | Authenticated | Client-side Razorpay signature verification |
| `POST` | `/api/payments/webhook` | Gateway Only | Webhook payment capture & reconciliation |
| `PATCH` | `/api/orders/:id/cancel` | Authenticated | Cancel order with automatic inventory restock |
| `GET` | `/api/admin/metrics` | Admin Only | `$facet` operational and financial analytics |
| `GET` | `/api/health` | Public | Liveness and database connectivity probe |

---

## 7. Deep-Dive Documentation

- [System Architecture Specification](docs/ARCHITECTURE.md)
- [Phased Engineering Roadmap](docs/PHASES.md)
- [Production Deployment Runbook](docs/DEPLOYMENT_GUIDE.md)
- [Senior SDE Interview Cheat-Sheet](docs/INTERVIEW_CHEATSHEET.md)
- [UI / UX Design Tokens & Style Guide](docs/UI_STYLE_GUIDE.md)

---

## 8. License

This project is open source and available under the [MIT License](LICENSE).
