# Production-Grade Authentication, Authorization & User Management

This document defines the production-grade **Authentication (AuthN)**, **Role-Based Access Control (RBAC)**, **PostgreSQL Data Model**, and **Device Scoping Architecture** for the Omada NOC Dashboard.

---

## 🏛️ Architecture & RBAC Flow Diagram

```
                              ┌────────────────────────┐
                              │  User Accesses / Login │
                              └───────────┬────────────┘
                                          │
                                  POST /api/auth/login
                                          │
                     ┌────────────────────▼────────────────────┐
                     │ Authenticate against PostgreSQL (bcrypt)│
                     │ Logs entry to `user_logins` audit table │
                     │ Issues HTTP-Only, Secure JWT Session    │
                     └────────────────────┬────────────────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    ▼                                           ▼
      ┌───────────────────────────┐               ┌───────────────────────────┐
      │       Role: ADMIN         │               │        Role: USER         │
      ├───────────────────────────┤               ├───────────────────────────┤
      │ • Full Telemetry (All 70+)│               │ • Checks Tagged Devices:  │
      │ • User Management Screen  │               │   - If Tagged: Sees ONLY  │
      │ • Device Tagging Matrix   │               │     their devices & KPIs  │
      │ • Paginated Login Audits  │               │   - If NOT Tagged: Sees   │
      │ • Profile Management      │               │     everything (fallback) │
      │ • 15-Min Inactivity Logout│               │ • Profile Management      │
      └───────────────────────────┘               │ • 15-Min Inactivity Logout│
                                                  └───────────────────────────┘
```

---

## 🗄️ Database & Storage Engine Architecture

The database layer utilizes a **Dual-Mode Persistence Architecture**:
1. **Production & Container Mode (PostgreSQL 16):** Uses pure-TypeScript connection pooling (`pg`) with prepared statement parameterization, ACID transactional safety, and full indexing.
2. **Local Development Fallback Mode (In-Memory Store):** If PostgreSQL is not active on `localhost:5432` when starting `npm run dev`, the application automatically and transparently activates an In-Memory Database Store seeded with the default `admin@omadanoc.com` account. This provides instant zero-dependency local development with zero external configuration needed.

### 1. `users` Table
Stores primary user identities, credentials, and access roles.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `gen_random_uuid()` | Unique user identifier |
| `username` | `VARCHAR(50)` | UNIQUE, NOT NULL | System username |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL | User email address |
| `password_hash` | `TEXT` | NOT NULL | Salted password hash (`bcryptjs`) |
| `role` | `VARCHAR(20)` | NOT NULL, DEFAULT `'USER'` | Access level: `'ADMIN'` or `'USER'` |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `NOW()` | Account creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `NOW()` | Last account update timestamp |

### 2. `user_profiles` Table
Stores extended user profile metadata, contact info, and customization preferences.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `gen_random_uuid()` | Unique profile identifier |
| `user_id` | `UUID` | UNIQUE, FK `users(id)` ON DELETE CASCADE | Associated user account |
| `full_name` | `VARCHAR(100)` | NOT NULL, DEFAULT `''` | User's display name |
| `job_title` | `VARCHAR(100)` | DEFAULT `''` | Professional title (e.g. Network Engineer) |
| `department` | `VARCHAR(100)` | DEFAULT `''` | Department / Organization unit |
| `avatar_url` | `TEXT` | DEFAULT `''` | Custom avatar image URL or gravatar |
| `theme` | `VARCHAR(20)` | DEFAULT `'dark'` | UI theme preference (`'dark'`, `'light'`, `'system'`) |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `NOW()` | Profile last updated timestamp |

### 3. `user_device_tags` Table
Maps specific physical hardware MAC addresses to user accounts for multi-tenant telemetry scoping.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `gen_random_uuid()` | Unique tag identifier |
| `user_id` | `UUID` | FK `users(id)` ON DELETE CASCADE | Owner user account |
| `mac_address` | `VARCHAR(30)` | NOT NULL | Normalized MAC address (`AA:BB:CC:DD:EE:FF`) |
| `device_name` | `VARCHAR(100)` | DEFAULT `''` | Friendly device name or alias |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `NOW()` | Tag creation timestamp |
| *Constraint* | `UNIQUE(user_id, mac_address)` | Prevents duplicate tagging for the same user. |

### 4. `user_logins` Table (Audit Trail)
Tracks all login attempts, authentication successes, and security failures for compliance and administrative monitoring.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `gen_random_uuid()` | Unique login record identifier |
| `user_id` | `UUID` | Nullable, FK `users(id)` ON DELETE SET NULL | User account (if resolved) |
| `email` | `VARCHAR(255)` | NOT NULL | Login email attempted |
| `ip_address` | `VARCHAR(45)` | NOT NULL, DEFAULT `'127.0.0.1'` | Client IP address |
| `user_agent` | `TEXT` | DEFAULT `''` | Client browser / user-agent header |
| `login_status` | `VARCHAR(20)` | NOT NULL | Result: `'SUCCESS'` or `'FAILED'` |
| `failure_reason` | `TEXT` | Nullable | Reason for failure (e.g. "Invalid password", "User not found") |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `NOW()` | Timestamp of authentication attempt |

---

## 🔒 Security Policies & Session Management

### 1. Stateless Encrypted JWT Sessions
- Authenticated sessions are encoded into signed JSON Web Tokens using `jose` with SHA-256 HMAC encryption.
- Tokens are stored exclusively in HTTP-only, secure, same-site cookies (`noc_session`) to mitigate Cross-Site Scripting (XSS) and Cross-Site Request Forgery (CSRF).

### 2. Next.js Edge Proxy & Route Guards (`proxy.ts`)
- **Main Dashboard & UI Protection:** The edge proxy intercepts all incoming requests before rendering. If the `noc_session` cookie is missing or invalid, the user is immediately redirected to `/login`.
- **Server-Side SSR Guard (`app/page.tsx`):** The server-rendered root page verifies `getCurrentSession()` before initiating any controller telemetry fetches, calling Next.js `redirect('/login')` if unauthenticated.
- **Login Route Redirect:** When an already authenticated user accesses `/login`, the proxy automatically redirects them to the main dashboard `/`.
- **API Guard:** Protected API routes (`/api/telemetry`, `/api/auth/me`, `/api/admin/*`) return `401 Unauthorized` JSON if unauthenticated, and `403 Forbidden` if an unauthorized non-admin attempts admin operations.

### 3. 15-Minute Inactivity Timeout
- **Client-Side Monitor:** A React interaction listener (`mousemove`, `keydown`, `click`, `scroll`) tracks user activity. If 15 minutes elapse without interaction, the client immediately invalidates the local session, triggers `/api/auth/logout`, and redirects to `/login?reason=inactivity`.
- **Server-Side Enforcement:** Every session token encapsulates an expiration timestamp (`exp`). Expired tokens are rejected with HTTP 401.

### 4. Password Security & Salting
- Passwords are encrypted using `bcryptjs` with standard 10-round salt hashing.
- Plaintext passwords are never stored or logged in database queries.

---

## 🛡️ Role-Based Access Control (RBAC) & Scoping

| Feature / Area | `ADMIN` Role | `USER` Role (With Tagged Devices) | `USER` Role (No Tagged Devices) |
| :--- | :---: | :---: | :---: |
| **Telemetry Dashboard** | Global (All 70+ Devices) | Scoped strictly to tagged MACs | Global (Sees everything per policy) |
| **KPI Aggregate Cards** | Global Throughput & Volume | Recalculated for tagged devices only | Global Throughput & Volume |
| **Profile Widget & Edit** | ✅ Full Access | ✅ Full Access | ✅ Full Access |
| **User Directory (`/admin/users`)** | ✅ Full Access | ❌ Forbidden (403) | ❌ Forbidden (403) |
| **Device Tagging Matrix** | ✅ Full Access | ❌ Forbidden (403) | ❌ Forbidden (403) |
| **Login Audit Log (10/page)** | ✅ Full Access | ❌ Forbidden (403) | ❌ Forbidden (403) |
| **Network Health Audits** | ✅ Full Access | ❌ Forbidden (403) | ❌ Forbidden (403) |

---

## 🖥️ User Interface Components

### 1. Login Page & Matrix Authorization Stream (`/login`)
- **Immersive Cyber Matrix Authorization Overlay:**
  - Upon submission, replaces the form with a full-screen canvas digital rain stream with glowing cyan telemetry cipher characters.
  - Displays a cyber radar HUD with multi-ring animation and real-time handshake logs (`[TLS 1.3] HANDSHAKE ESTABLISHED`, `EVALUATING RBAC POLICIES`, `AUTHORIZING NOC CONTROLLER BRIDGE`).
  - Implements a deterministic minimum 1000ms animation duration to eliminate UI jumpiness and provide an immersive NOC authorization sequence.
  - **Quick Demo Fill Helper:** Provides a 1-click button to populate default generic administrator credentials (`admin@omadanoc.com` / `AdminPass123!`).
  - **Inactivity Banner:** Detects `?reason=inactivity` and displays an explicit session timeout warning.

### 2. Profile Widget (Top Right Corner)
- Positioned in the global navigation bar.
- Shows user avatar / initials badge, display name, and role tag (`ADMIN` or `USER`).
- Dropdown menu options:
  - **Edit Profile (`/profile`)**: Update display name, job title, department, theme preference, or change password.
  - **User Management (`/admin/users`)**: Visible only to administrators.
  - **Logout**: Clears session and redirects to `/login`.

### 3. Profile Page (`/profile`)
- **Personal Information Card:** Edit full name, job title, department, avatar URL, and theme preference.
- **Account Credentials Card:** Change password (requires current password verification).
- **Assigned Devices Card:** Shows the user a list of physical devices currently tagged to their account.

### 4. Admin User Management Screen (`/admin/users`)
- **User Directory Tab:** View all accounts, change roles (`ADMIN` $\leftrightarrow$ `USER`), delete accounts, or open device tagging modal.
- **Device Tagging Modal:** Pick from live discovered Omada network devices or manually input a MAC address with a custom label.
- **Login History Audit Tab:** Paginated audit log showing **10 records per page** with timestamp, user email, IP address, user agent, and status badge (`SUCCESS` / `FAILED`).

---

## 🔑 Default Initial Credentials (Generic)

When the PostgreSQL database is first initialized, the system automatically creates the root administrator account:

| Field | Default Value | Description |
| :--- | :--- | :--- |
| **Email** | `admin@omadanoc.com` | Primary administrator login |
| **Username** | `admin` | Administrator username |
| **Default Password** | `AdminPass123!` | Initial password (change on first login) |
| **Role** | `ADMIN` | Superuser privileges |

---

## 🔌 API Route Architecture

| Route | Method | Access Level | Description |
| :--- | :---: | :---: | :--- |
| `/api/auth/login` | `POST` | Public | Authenticates credentials, writes to `user_logins`, sets HTTP-only cookie. |
| `/api/auth/logout` | `POST` | Authenticated | Clears session cookie. |
| `/api/auth/me` | `GET` | Authenticated | Returns current session user, profile, and tagged devices list. |
| `/api/auth/profile` | `PUT` | Authenticated | Updates user profile metadata and optional password change. |
| `/api/telemetry` | `GET` | Authenticated | Returns live telemetry scoped by user's role and tagged MACs. |
| `/api/admin/users` | `GET`, `POST` | **Admin Only** | Lists users with tagged device counts, or creates a new user. |
| `/api/admin/users/[id]` | `PUT`, `DELETE` | **Admin Only** | Updates role, resets password, or deletes a user. |
| `/api/admin/users/[id]/devices` | `GET`, `POST`, `DELETE` | **Admin Only** | Assigns or unassigns device MAC tags to a user. |
| `/api/admin/logins` | `GET` | **Admin Only** | Returns paginated login history (10 per page) with total count. |
