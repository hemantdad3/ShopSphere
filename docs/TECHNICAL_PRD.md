# ShopSphere --- Technical PRD

## 1. Stack

### Frontend

-   React
-   React Router
-   Tailwind CSS
-   Axios
-   Optional TanStack Query

### Backend

-   Node.js
-   Express.js
-   Mongoose
-   JWT
-   bcrypt
-   Zod/Joi/express-validator
-   Helmet
-   CORS
-   Rate limiting

### Services

-   MongoDB Atlas
-   Razorpay
-   Cloudinary
-   Resend/Nodemailer

### Deployment

-   Vercel: frontend
-   Render: backend
-   MongoDB Atlas: database

## 2. Architecture

Browser → React/Vercel → HTTPS REST API → Express/Render → MongoDB
Atlas.

Backend integrations: - Razorpay: payments - Cloudinary: product
images - Email provider: notifications

Use a modular monolith. Do not introduce microservices without a
demonstrated requirement.

## 3. Authentication

-   Backend issues JWT after login.
-   Prefer HTTP-only cookie transport.
-   Frontend requests use credentials.
-   Production cookies require HTTPS and appropriate SameSite/Secure
    settings.
-   CORS allows only the deployed frontend origin.
-   Authentication middleware verifies JWT.
-   Authorization middleware verifies role.

Authentication answers who the user is; authorization determines what
they can do.

## 4. Data Models

### User

\_id, name, email(unique), passwordHash, role(USER\|ADMIN),
addresses\[\], wishlist\[\], createdAt, updatedAt.

### Product

\_id, name, slug(unique), description, price, discount, category,
images\[\], stock, ratingAverage, reviewCount, createdAt, updatedAt.

### Cart

\_id, userId(unique), items\[{productId, quantity}\], updatedAt.

### Order

\_id, userId, items\[{productId, productNameSnapshot, unitPriceSnapshot,
quantity, imageSnapshot}\], shippingAddressSnapshot, subtotal, discount,
totalAmount, paymentStatus, paymentProvider, paymentOrderId, paymentId,
orderStatus, createdAt, updatedAt.

### Review

\_id, userId, productId, orderId, rating, comment, createdAt, updatedAt.

## 5. Important Indexes

-   User.email unique
-   Product.slug unique
-   Product.category
-   Product.createdAt
-   Product.price when price filtering is frequent
-   Order.userId + createdAt
-   Review.productId
-   Cart.userId unique

Measure query performance before adding more indexes.

## 6. Critical Invariants

1.  Never trust client totals or prices.
2.  Never trust client roles.
3.  Admin APIs require backend authorization.
4.  Inventory cannot become negative.
5.  Payment/webhook processing must be safe to repeat.
6.  Frontend payment success alone cannot mark an order paid.
7.  Reviews require purchase eligibility.
8.  Orders preserve historical product prices.

## 7. Inventory Strategy

At checkout: 1. Validate cart. 2. Read current product data. 3. Attempt
atomic stock decrement conditioned on sufficient stock. 4. If multiple
documents must change consistently, use an appropriate MongoDB
transaction. 5. Create/update order consistently. 6. Make retries safe.

The exact implementation should avoid a read-then-later-write race where
two requests both observe the same stock.

## 8. Payment Strategy

1.  Backend calculates amount.
2.  Backend creates Razorpay order.
3.  Frontend opens checkout.
4.  Backend verifies payment.
5.  Webhook provides reconciliation.
6.  Payment/order state transitions are idempotent.
7.  Secrets remain server-side.

## 9. Error Format

Use a consistent response such as: { "success": false, "message":
"Product is out of stock", "code": "OUT_OF_STOCK" }

Use appropriate 200, 201, 400, 401, 403, 404, 409, 422, 429 and 500
responses.

## 10. Testing Priorities

-   Authentication middleware
-   Admin authorization
-   Product permissions
-   Cart price validation
-   Order creation
-   Inventory concurrency
-   Payment verification
-   Idempotency
-   Review purchase eligibility
