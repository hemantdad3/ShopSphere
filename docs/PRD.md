# ShopSphere --- Product Requirements Document

## 1. Product Overview

ShopSphere is a production-oriented single-vendor e-commerce platform.
One store administrator manages the catalog, inventory and orders;
customers browse products, purchase them online, and track their orders.

The project is intentionally backend-first and is designed to
demonstrate software-engineering depth for SDE placements.

## 2. Goals

-   Build a realistic end-to-end e-commerce workflow.
-   Demonstrate secure authentication and role-based authorization.
-   Demonstrate REST API and database design.
-   Integrate Razorpay reliably.
-   Prevent inventory overselling under concurrent purchases.
-   Provide search, filtering, sorting and pagination.
-   Include testing, validation, error handling and production
    deployment.

## 3. Roles

### Customer

-   Register/login/logout
-   Browse/search/filter/sort products
-   View product details
-   Add/update/remove cart items
-   Manage addresses
-   Checkout and pay
-   View order history/details
-   Track order status
-   Wishlist
-   Review purchased products

### Admin

-   Secure admin access
-   Dashboard
-   Product CRUD
-   Product image management
-   Inventory management
-   View customers
-   View all orders
-   Update order status
-   Moderate reviews

Only one admin account is required in V1.

## 4. Customer Flow

Login → Browse → Product Details → Cart → Checkout → Backend validates
price/stock → Razorpay order → Payment → Server verification/webhook →
Order confirmation → Inventory update → Order tracking.

## 5. Admin Flow

Admin Login → Dashboard → Products/Inventory → Orders → Update Status →
Monitor sales.

## 6. Functional Requirements

### Authentication

-   Email/password registration and login
-   Password hashing
-   JWT authentication
-   Prefer JWT in HTTP-only cookies
-   Protected routes
-   Backend role authorization
-   Logout
-   Password reset can be added after MVP

### Products

-   Name, description, price, discount, category
-   Images
-   Stock
-   Rating summary
-   Timestamps
-   Admin CRUD

### Discovery

-   Search
-   Category and price filters
-   Sort by price/newest/popularity
-   Pagination

### Cart

-   One cart per customer
-   Add/update/remove
-   Server-side total calculation
-   Revalidate price and stock at checkout

### Orders

-   Preserve product name/price/image snapshots
-   Shipping address snapshot
-   Subtotal, discount, total
-   Payment status and IDs
-   Order status and timestamps

Suggested states: `PLACED → CONFIRMED → SHIPPED → DELIVERED` or
`PLACED → CANCELLED`

### Payments

-   Razorpay order creation on backend
-   Client checkout
-   Server-side verification
-   Webhook/reconciliation
-   Idempotent processing
-   Failure/retry handling

### Inventory

-   Never allow negative stock
-   Revalidate stock at checkout
-   Use atomic updates/transactions where appropriate
-   Handle simultaneous purchases safely

### Reviews

-   1--5 stars and comment
-   Only qualifying purchasers may review
-   Admin moderation

### Wishlist

-   Add/remove
-   Move item to cart

### Notifications

-   Order confirmation
-   Shipping
-   Delivery
-   Optional for MVP, recommended for production version

## 7. Non-Functional Requirements

-   Secure cookies and HTTPS in production
-   Restricted CORS
-   Request validation
-   Rate limiting on sensitive endpoints
-   Helmet/security headers
-   Secrets only in environment variables
-   Centralized error handling
-   Structured logging
-   Database indexes for common queries
-   Paginated APIs
-   Focused automated tests

## 8. Out of Scope for V1

-   Multiple sellers
-   Microservices
-   Kafka
-   Kubernetes
-   Elasticsearch
-   AI recommendations
-   Complex loyalty/coupon systems
-   Real-time delivery maps

## 9. Definition of Done

A customer can register, browse, add an item, pay through Razorpay, and
receive a persisted order. An admin can manage products/inventory and
update orders. Unauthorized users cannot access admin APIs. Concurrent
checkout cannot oversell stock. Critical backend behavior has tests. The
application is deployed and documented.
