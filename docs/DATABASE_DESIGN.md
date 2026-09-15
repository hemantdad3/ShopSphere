# ShopSphere --- Database Design

## 1. User

``` text
User
├── _id
├── name
├── email [unique]
├── passwordHash
├── role
├── addresses[]
├── wishlist[]
├── createdAt
└── updatedAt
```

Constraints: - Email unique. - Password is never stored in plaintext. -
Role is controlled by backend.

## 2. Product

``` text
Product
├── _id
├── name
├── slug [unique]
├── description
├── price
├── discount
├── category
├── images[]
├── stock
├── ratingAverage
├── reviewCount
├── createdAt
└── updatedAt
```

Indexes: - slug - category - createdAt - price when justified

## 3. Cart

``` text
Cart
├── _id
├── userId [unique]
├── items[]
│   ├── productId
│   └── quantity
└── updatedAt
```

The cart is not authoritative for price. Prices are re-read from Product
during checkout.

## 4. Order

``` text
Order
├── _id
├── userId
├── items[]
│   ├── productId
│   ├── productNameSnapshot
│   ├── unitPriceSnapshot
│   ├── quantity
│   └── imageSnapshot
├── shippingAddressSnapshot
├── subtotal
├── discount
├── totalAmount
├── paymentStatus
├── paymentProvider
├── paymentOrderId
├── paymentId
├── orderStatus
├── createdAt
└── updatedAt
```

### Why snapshots?

If an admin changes a product from ₹1,000 to ₹1,200 tomorrow,
yesterday's order must still show ₹1,000.

## 5. Review

``` text
Review
├── _id
├── userId
├── productId
├── orderId
├── rating
├── comment
└── timestamps
```

A uniqueness rule can prevent multiple reviews for the same qualifying
order/product if that matches the business rule.

## 6. Inventory Consistency

Do not implement:

``` text
read stock
→ if stock >= quantity
→ later update stock
```

without concurrency protection.

Prefer an atomic conditional update or transaction:

``` text
update Product
where stock >= requestedQuantity
set stock = stock - requestedQuantity
```

If no document is modified, the requested quantity is unavailable.

For multi-document operations, use a transaction where appropriate.

## 7. Order State

Recommended:

``` text
PLACED
  ↓
CONFIRMED
  ↓
SHIPPED
  ↓
DELIVERED
```

Cancellation should be allowed only in explicitly defined states.

## 8. Data Integrity

-   Financial values are calculated server-side.
-   Order snapshots preserve historical truth.
-   Inventory cannot be negative.
-   Payment transitions are validated.
-   User ownership is checked before returning/modifying private
    resources.
