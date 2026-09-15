# ShopSphere --- REST API Specification

Base URL: `/api`

## Auth

### POST /auth/register

Create customer account.

### POST /auth/login

Authenticate and set JWT cookie.

### POST /auth/logout

Clear authentication cookie.

### GET /auth/me

Return authenticated user.

### POST /auth/forgot-password

Start password reset.

### POST /auth/reset-password

Complete password reset.

## Products

### GET /products

Public product listing.

Query parameters: - `page` - `limit` - `search` - `category` -
`minPrice` - `maxPrice` - `sort`

### GET /products/:id

Product details.

### POST /products

Admin only.

### PATCH /products/:id

Admin only.

### DELETE /products/:id

Admin only.

## Cart

### GET /cart

Get current user's cart.

### POST /cart/items

Add product/quantity.

### PATCH /cart/items/:productId

Change quantity.

### DELETE /cart/items/:productId

Remove item.

## Orders

### POST /orders

Create checkout/order workflow after server-side validation.

### GET /orders

Customer's orders; admin may have a separate admin endpoint.

### GET /orders/:id

Customer may view own order; admin may view any order.

### POST /orders/:id/cancel

Cancel according to business rules.

## Payments

### POST /payments/create-order

Create Razorpay payment order from authoritative server-side amount.

### POST /payments/verify

Verify payment response.

### POST /payments/webhook

Receive provider webhook and reconcile payment state.

## Reviews

### GET /products/:id/reviews

List reviews.

### POST /products/:id/reviews

Authenticated purchaser only.

### PATCH /reviews/:id

Owner/admin according to moderation rules.

### DELETE /reviews/:id

Owner/admin according to moderation rules.

## Admin

### GET /admin/dashboard

Summary metrics.

### GET /admin/orders

List orders with filters/pagination.

### PATCH /admin/orders/:id/status

Update order state.

### GET /admin/users

List customers with pagination.

## API Rules

-   Validate all request bodies/query parameters.
-   Authenticate protected endpoints.
-   Authorize admin operations server-side.
-   Do not accept final prices from the client.
-   Return consistent error objects.
-   Paginate potentially large collections.
-   Use 409 for appropriate state conflicts.
-   Avoid leaking implementation details in production errors.
