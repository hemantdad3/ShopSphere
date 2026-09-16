# ShopSphere Production Deployment & Runbook Guide

Complete deployment and operations manual for hosting the **ShopSphere** production platform across **Render (Backend API)**, **Vercel (Frontend React SPA)**, and **MongoDB Atlas (Database Cluster)**.

---

## 1. Production Architecture Topology

```
┌────────────────────────────────┐         HTTPS          ┌────────────────────────────────┐
│         Vercel (Client)        │  ────────────────────> │         Render (Server)        │
│   https://shopsphere.vercel.app│ <────────────────────  │ https://shopsphere.onrender.com│
└────────────────────────────────┘    Cross-Domain JWT    └────────────────────────────────┘
                 │                                                        │
                 │ Images / Media                                         │ Queries
                 ▼                                                        ▼
┌────────────────────────────────┐                        ┌────────────────────────────────┐
│      ImageKit.io Media CDN     │                        │       MongoDB Atlas Cluster    │
│    https://ik.imagekit.io/*    │                        │  Replica Set (Oregon / AWS)    │
└────────────────────────────────┘                        └────────────────────────────────┘
```

---

## 2. Step 1: Database Setup (MongoDB Atlas)

1. **Log in to MongoDB Atlas:** [https://cloud.mongodb.com](https://cloud.mongodb.com)
2. **Network Access (IP Whitelist):**
   - Navigate to **Security > Network Access**.
   - Click **Add IP Address** and add `0.0.0.0/0` (Allow Access from Anywhere) with a comment like `Production PaaS Instances`.
   - *Rationale:* Cloud hosting platforms like Render and Vercel allocate dynamic outbound IP addresses unless a dedicated static outbound IP add-on is purchased.
3. **Database User Credentials:**
   - Navigate to **Security > Database Access**.
   - Ensure you have an application user (e.g. `shopsphere_admin`) with `readWriteAnyDatabase` or scoped read/write permissions on the `shopsphere` database.
4. **Acquire Connection String:**
   - Click **Connect > Drivers > Node.js**.
   - Format:
     ```text
     mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/shopsphere?retryWrites=true&w=majority&appName=ShopSphere
     ```

---

## 3. Step 2: Backend Deployment (Render Web Service)

### Option A: Automatic Deployment via `render.yaml`
1. Log in to [https://dashboard.render.com](https://dashboard.render.com).
2. Click **New > Blueprint**.
3. Select the `hemantdad3/ShopSphere` GitHub repository.
4. Render will automatically detect [`render.yaml`](file:///e:/Projects/ShopSphere_Antigravity_PRD/render.yaml) and configure the service.
5. Fill in the required environment variables prompted in the dashboard.

### Option B: Manual Web Service Creation
1. Click **New > Web Service**.
2. Connect your GitHub repository: `hemantdad3/ShopSphere`.
3. Configure the service settings:
   - **Name:** `shopsphere-backend`
   - **Region:** `Oregon (US West)` (closest to MongoDB Atlas cluster)
   - **Branch:** `main`
   - **Root Directory:** `server`
   - **Runtime:** `Node`
   - **Build Command:** `npm ci`
   - **Start Command:** `node src/server.js`
   - **Plan:** `Free`
4. **Health Check Path:**
   - Expand **Advanced** and set **Health Check Path** to `/api/health`.

### Environment Variables Configuration:
Add the following key-value pairs in **Environment Variables**:

| Variable Name | Required | Example / Production Value |
|:---|:---:|:---|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | `5000` (or leave default assigned by Render) |
| `MONGO_URI` | Yes | `mongodb+srv://...` (Atlas connection string) |
| `JWT_SECRET` | Yes | 64-character cryptographically random secret string |
| `JWT_EXPIRES_IN` | Yes | `7d` |
| `JWT_COOKIE_EXPIRES_IN` | Yes | `7` |
| `CLIENT_URL` | Yes | `https://shopsphere.vercel.app` (your Vercel frontend URL) |
| `RAZORPAY_KEY_ID` | Yes | Your production Razorpay Key ID |
| `RAZORPAY_KEY_SECRET` | Yes | Your production Razorpay Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | Your production Razorpay Webhook Secret |
| `IMAGEKIT_PUBLIC_KEY` | Optional | ImageKit public key |
| `IMAGEKIT_PRIVATE_KEY` | Optional | ImageKit private key |
| `IMAGEKIT_URL_ENDPOINT` | Optional | `https://ik.imagekit.io/<your_id>` |

---

## 4. Step 3: Frontend Deployment (Vercel)

1. Log in to [https://vercel.com](https://vercel.com).
2. Click **Add New > Project**.
3. Import the `hemantdad3/ShopSphere` GitHub repository.
4. Configure the project:
   - **Root Directory:** Click **Edit** and choose `client`.
   - **Framework Preset:** `Vite` (auto-detected).
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. **Environment Variables:**
   - Key: `VITE_API_URL`
   - Value: `https://shopsphere-backend.onrender.com/api` (the URL assigned to your Render backend)
6. Click **Deploy**.
7. Vercel will build the project using [`client/vercel.json`](file:///e:/Projects/ShopSphere_Antigravity_PRD/client/vercel.json), ensuring single-page routing rewrites all routes (`/catalog`, `/cart`, `/orders`, `/admin`) to `/index.html`.

---

## 5. Step 4: Cross-Domain Cookie & CORS Configuration

Because the client is hosted on Vercel (`*.vercel.app`) and the server is hosted on Render (`*.onrender.com`), they represent distinct top-level domains. ShopSphere implements **the modern cross-domain security standard**:

1. **Cookie Attributes (`server/src/utils/jwt.js`):**
   ```javascript
   const cookieOptions = {
     expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
     httpOnly: true,        // Immunizes session against JavaScript XSS theft
     secure: true,          // Mandates transmission strictly over HTTPS
     sameSite: 'none',      // Permits cross-site transmission between Vercel and Render
     partitioned: true,     // CHIPS standard for Chrome/Safari third-party cookie handling
     path: '/',
   };
   ```
2. **CORS Configuration (`server/src/app.js`):**
   ```javascript
   app.use(cors({
     origin: process.env.CLIENT_URL, // e.g. https://shopsphere.vercel.app
     credentials: true,             // Permits transmission of cookies in CORS requests
   }));
   ```
3. **Client Fetch Configuration (`client/src/services/api.js`):**
   ```javascript
   const config = {
     ...options,
     credentials: 'include',        // Always forwards cookies cross-domain
   };
   ```

---

## 6. Step 5: Post-Deployment Smoke Test Checklist

Once both services are live, perform this end-to-end verification run:

- [ ] **Health Check Probe:**
  - Visit `https://shopsphere-backend.onrender.com/api/health` in your browser.
  - Verify JSON response: `{ "success": true, "status": "ok", "db": "connected" }`.
- [ ] **Security Headers:**
  - Inspect response headers in Chrome DevTools: verify `x-content-type-options: nosniff` is present and `x-powered-by` is omitted.
- [ ] **User Registration & Cookie:**
  - Visit `https://shopsphere.vercel.app/register`.
  - Register a new account. Check DevTools > Application > Cookies: verify `jwt` cookie is set with `Secure`, `HttpOnly`, and `SameSite=None`.
- [ ] **Catalog & Discovery:**
  - Browse public products on the homepage.
  - Test category pills and price sorting.
- [ ] **Shopping Cart:**
  - Add an item to the cart. Open the slide-out cart drawer and verify totals.
- [ ] **Checkout:**
  - Proceed to checkout. Fill in a delivery address.
  - Verify Razorpay modal launches. Complete payment.
- [ ] **Order Confirmation:**
  - Confirm redirect to `/orders` with the newly created order displayed in `CONFIRMED` state.
- [ ] **Admin Console:**
  - Log in with admin credentials and verify executive revenue metrics load at `/admin`.

---

## 7. Step 6: Production Monitoring & Cold Start Mitigation

> [!TIP]
> **Free Tier Sleep Mitigation:**
> Render free-tier web services spin down after 15 minutes of inactivity, resulting in a ~30-second cold start on the next request.
> 
> **To prevent cold starts for recruiter and portfolio evaluations:**
> 1. Sign up for a free monitor at [UptimeRobot](https://uptimerobot.com) or [Cron-Job.org](https://cron-job.org).
> 2. Create a new **HTTP(s) Monitor**:
>    - **URL:** `https://shopsphere-backend.onrender.com/api/health`
>    - **Interval:** Every 10 minutes.
> 3. This keeps the Node.js process continuously warm in memory, guaranteeing instantaneous response times for evaluators.
