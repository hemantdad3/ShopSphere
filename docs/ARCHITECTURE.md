# ShopSphere --- System Architecture

## 1. High-Level Architecture

``` text
Customer/Admin Browser
        |
        v
React Frontend (Vercel)
        |
   HTTPS + REST
        |
        v
Express API (Render)
   |       |        |
   v       v        v
MongoDB  Razorpay  Cloudinary
Atlas
        |
        v
Email Provider
```

## 2. Backend Layers

``` text
Routes
  ↓
Middleware
  ├── Authentication
  ├── Authorization
  ├── Validation
  └── Rate Limiting
  ↓
Controllers
  ↓
Services / Business Logic
  ↓
Models / Database
  ↓
External Services
```

Controllers should stay thin. Business rules belong in
service/business-logic layers where useful.

## 3. Suggested Backend Structure

``` text
server/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── validators/
│   ├── utils/
│   ├── tests/
│   ├── app.js
│   └── server.js
└── package.json
```

## 4. Frontend Structure

``` text
client/
├── src/
│   ├── components/
│   ├── pages/
│   ├── layouts/
│   ├── hooks/
│   ├── services/
│   ├── context/
│   ├── utils/
│   ├── routes/
│   └── App.jsx
└── package.json
```

## 5. Authentication Flow

``` text
Login
  ↓
Express verifies credentials
  ↓
JWT generated
  ↓
HTTP-only cookie
  ↓
Browser sends cookie with credentialed API requests
  ↓
Auth middleware verifies JWT
  ↓
Authorization middleware checks role
```

For Vercel frontend + Render backend, configure credentialed CORS,
production HTTPS, cookie SameSite/Secure settings, and Axios/fetch
credentials correctly.

## 6. Checkout Architecture

``` text
Cart
 ↓
Backend re-fetches prices/stock
 ↓
Calculate authoritative total
 ↓
Reserve/decrement inventory safely
 ↓
Create payment/order state
 ↓
Razorpay
 ↓
Verify payment
 ↓
Finalize order
 ↓
Clear cart
```

The exact transaction boundary should be designed carefully so payment
failures do not leave inconsistent inventory/order state.

## 7. Reliability

-   Idempotency keys or equivalent unique constraints for
    retry-sensitive operations
-   Webhook reconciliation
-   Atomic inventory updates
-   Consistent order state transitions
-   Centralized errors
-   Logging

## 8. Scalability Discussion

Start with a modular monolith. If traffic grows: - Add caching for
frequently-read product data. - Add Redis for suitable ephemeral/cache
workloads. - Introduce a queue for email/notification jobs. - Use
CDN/image optimization. - Scale API instances horizontally. - Move
search to a dedicated search service only when query scale justifies
it. - Split services only around clear scaling/ownership boundaries.

## 9. Database Entity-Relationship (ER) Architecture

```text
┌─────────────────┐       1:1       ┌─────────────────┐
│      User       │ ─────────────── │      Cart       │
│  - _id          │                 │  - _id          │
│  - email (uniq) │                 │  - user (ref)   │
│  - role         │                 │  - items []     │
│  - isBlocked    │                 └─────────────────┘
└────────┬────────┘
         │
         │ 1:N
         ├──────────────────────────┐
         │                          │
         ▼                          ▼
┌─────────────────┐        ┌─────────────────┐
│      Order      │        │     Review      │
│  - _id          │        │  - _id          │
│  - customer     │        │  - user (ref)   │
│  - items []     │        │  - product (ref)│
│    (snapshot)   │        │  - rating (1-5) │
│  - status (FSM) │        │  - isVerified   │
│  - paymentStatus│        └────────┬────────┘
└─────────────────┘                 │
                                    │ N:1
                                    ▼
┌─────────────────┐  N:1   ┌─────────────────┐
│    Category     │ ◄───── │     Product     │
│  - _id          │        │  - _id          │
│  - name         │        │  - title / slug │
│  - slug (uniq)  │        │  - category     │
│  - isActive     │        │  - stock ($inc) │
└─────────────────┘        │  - ratingsAvg   │
                           │  - numReviews   │
                           └─────────────────┘
```
