# Production-Grade Authentication, Authorization & User Management

This document defines the production-grade **Authentication (AuthN)**, **Role-Based Access Control (RBAC)**, **PostgreSQL Data Model**, and **Device Scoping Architecture** for the Omada NOC Dashboard in accordance with enterprise security standards (**OWASP Top 10**, **NIST SP 800-63B**, **SOC 2**).

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
      │ • Absolute Session Window │               │ • 15-Min Inactivity Logout│
      └───────────────────────────┘               └───────────────────────────┘
```

---

## 🗄️ Database & Storage Engine Architecture

The persistence layer uses a **Dual-Mode Architecture**:
1. **Production & Container Mode (PostgreSQL 16):** Pure-TypeScript connection pooling (`pg`) with prepared statement parameterization, ACID transactional safety, and full indexing.
2. **Local Development Fallback Mode (In-Memory Store):** If PostgreSQL is not reachable on `localhost:5432` or encounters credential mismatches during `npm run dev`, the application automatically and transparently activates an In-Memory Database Store seeded with the default `admin@omadanoc.com` account. This provides instant zero-dependency local development with zero external configuration needed.

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
Maps physical hardware MAC addresses to user accounts for multi-tenant telemetry scoping.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `gen_random_uuid()` | Unique tag identifier |
| `user_id` | `UUID` | FK `users(id)` ON DELETE CASCADE | Owner user account |
| `mac_address` | `VARCHAR(30)` | NOT NULL | Normalized MAC address (`AA:BB:CC:DD:EE:FF`) |
| `device_name` | `VARCHAR(100)` | DEFAULT `''` | Friendly device name or alias |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `NOW()` | Tag creation timestamp |
| *Constraint* | `UNIQUE(user_id, mac_address)` | Prevents duplicate tagging for the same user. |

### 4. `user_logins` Table (Audit Trail)
Tracks all login attempts, authentication successes, and security failures for compliance and administrative monitoring (**SOC 2 / NIST SP 800-53**).

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

## 🔒 Security Policies & Cryptography Architecture

### 1. Stateless Signed JWT Session Tokens (JWS)
* **Cryptographic Standard:** Authenticated sessions are encoded into signed JSON Web Tokens using `jose` with **HMAC-SHA256 digital signatures (JWS / HS256)**.
* **Payload Integrity vs. Confidentiality:** The JWT payload is Base64URL-encoded (ensuring tamper resistance and authenticity via signature verification). Transport confidentiality is guaranteed through strict HTTPS/TLS and HTTP-only cookie isolation.
* **Cookie Transport Security:** Tokens are transmitted exclusively via HTTP-only, secure cookies (`noc_session`) with `SameSite=Lax` and `path=/`, mitigating Cross-Site Scripting (XSS) and Cross-Site Request Forgery (CSRF).
* **Host-Bound Cookie Recommendation:** In strict HTTPS production environments, deploying with the `__Host-` cookie prefix (`__Host-noc_session`) is recommended to prevent subdomain cookie injection.

### 2. Next.js 16 Edge Proxy & Route Guards (`proxy.ts`)
* **Multi-Layered Defense-in-Depth:**
  1. **Edge Proxy (`proxy.ts`):** Intercepts all incoming requests prior to rendering. Unauthenticated UI requests to `/`, `/profile`, or `/admin/*` are immediately redirected to `/login`. API calls return `401 Unauthorized` or `403 Forbidden`.
  2. **Server-Side SSR Guard (`app/page.tsx`):** Verifies `getCurrentSession()` before initiating any controller telemetry fetches, calling Next.js `redirect('/login')` if unauthenticated.
  3. **API Route Authorization:** Every administrative API route independently verifies that the authenticated user possesses the `ADMIN` role.
  4. **Self-Deletion Guard:** The user management API strictly forbids an active administrator from deleting their own account, preventing administrative lockout.

### 3. Inactivity Timeout & Absolute Session Window
* **15-Minute Sliding Window:** A client-side listener (`mousemove`, `keydown`, `click`, `scroll`) tracks active operator presence. If 15 minutes elapse without interaction, the client invalidates the local session, triggers `/api/auth/logout`, and redirects to `/login?reason=inactivity`.
* **Server-Side Token Expiration:** Each session token encapsulates an expiration claim (`exp`) and sliding `lastActive` timestamp. Expired tokens are rejected with HTTP 401.
* **Absolute Session Lifetime:** For enterprise compliance (NIST SP 800-63B), an absolute session ceiling of 12 hours is recommended to prevent indefinite rolling token renewal.

### 4. Password Security & Salting
* **Algorithm:** Passwords are encrypted using `bcryptjs` with standard 10-round cryptographic salt hashing (`SALT_ROUNDS = 10`).
* **Storage Standard:** Plaintext passwords are never stored in the database, logged in telemetry, or returned over API payloads.
* **Minimum Complexity Policy:** An 8-character minimum is enforced across user creation and profile password changes.

---

## 🛡️ Role-Based Access Control (RBAC) & Scoping

| Feature / Area | `ADMIN` Role | `USER` Role (With Tagged Devices) | `USER` Role (No Tagged Devices) |
| :--- | :---: | :---: | :---: |
| **Telemetry Dashboard** | Global (All 70+ Devices) | Scoped strictly to tagged MACs | Global (Open Read Fallback) |
| **KPI Aggregate Cards** | Global Throughput & Volume | Recalculated for tagged devices only | Global Throughput & Volume |
| **Profile Widget & Edit** | ✅ Full Access | ✅ Full Access | ✅ Full Access |
| **User Directory (`/admin/users`)** | ✅ Full Access | ❌ Forbidden (403) | ❌ Forbidden (403) |
| **Device Tagging Matrix** | ✅ Full Access | ❌ Forbidden (403) | ❌ Forbidden (403) |
| **Login Audit Log (10/page)** | ✅ Full Access | ❌ Forbidden (403) | ❌ Forbidden (403) |
| **Network Health Audits** | ✅ Full Access | ❌ Forbidden (403) | ❌ Forbidden (403) |

> **Policy Clarification — Open Read Fallback:**
> By design, non-admin users without assigned MAC tags receive an "Open Read Fallback" (full telemetry baseline visibility) to support general NOC monitoring. Once an administrator assigns one or more MAC addresses to a user, the system strictly scopes their visibility to only those physical devices.

---

## 🖥️ User Interface Components

### 1. Login Page & Matrix Authorization Stream (`/login`)
* **Immersive Cyber Matrix Authorization Overlay:**
  * Upon submission, replaces the form with a full-screen canvas digital rain stream with glowing cyan telemetry cipher characters.
  * Displays a cyber radar HUD with multi-ring animation and real-time handshake logs (`[TLS 1.3] HANDSHAKE ESTABLISHED`, `EVALUATING RBAC POLICIES`, `AUTHORIZING NOC CONTROLLER BRIDGE`).
  * Implements a deterministic **3-second duration (3000ms)** to eliminate UI jumpiness and provide an immersive NOC authorization sequence.
  * **Quick Demo Fill Helper:** Provides a 1-click button to populate default generic administrator credentials (`admin@omadanoc.com` / `AdminPass123!`).
  * **Auto-Select on Focus:** Clicking into the username or password field automatically highlights all text for instant replacement.
  * **Inactivity Banner:** Detects `?reason=inactivity` and displays an explicit session timeout warning.

### 2. Profile Widget (Top Right Corner)
* Positioned in the global navigation bar.
* Shows user avatar / initials badge, display name, and role tag (`ADMIN` or `USER`).
* Dropdown menu options:
  * **Edit Profile (`/profile`)**: Update display name, job title, department, theme preference, or change password.
  * **User Management (`/admin/users`)**: Visible only to administrators.
  * **Logout**: Clears session and redirects to `/login`.

### 3. Profile Page (`/profile`)
* **Personal Information Card:** Edit full name, job title, department, avatar URL, and theme preference.
* **Account Credentials Card:** Change password (requires current password verification).
* **Assigned Devices Card:** Shows the user a list of physical devices currently tagged to their account.

### 4. Admin User Management Screen (`/admin/users`)
* **User Directory Tab:** View all accounts, change roles (`ADMIN` $\leftrightarrow$ `USER`), delete accounts, or open device tagging modal.
* **Device Tagging Modal:** Pick from live discovered Omada network devices or manually input a MAC address with a custom label.
* **Login History Audit Tab:** Paginated audit log showing **10 records per page** with timestamp, user email, IP address, user agent, and status badge (`SUCCESS` / `FAILED`).

---

## 🔑 Default Initial Credentials & Production Hardening

When the database is first initialized, the system automatically bootstraps the initial administrator account:

| Field | Default Value | Description |
| :--- | :--- | :--- |
| **Email** | `admin@omadanoc.com` | Primary administrator login |
| **Username** | `admin` | Administrator username |
| **Default Password** | `AdminPass123!` | Initial password (must be rotated upon first login) |
| **Role** | `ADMIN` | Superuser privileges |

> [!CAUTION]
> **Production Hardening Checklist:**
> 1. **Mandatory Credential Rotation:** The default `admin@omadanoc.com` account is intended exclusively for initial system bootstrap. Rotate this password immediately upon initial deployment or supply `DEFAULT_ADMIN_EMAIL` and `DEFAULT_ADMIN_PASSWORD` in your production environment variables prior to first boot.
> 2. **Cryptographic Entropy (`JWT_SECRET`):** In production (`NODE_ENV=production`), generate a cryptographically secure 256-bit (32+ byte) secret key:
>    ```bash
>    openssl rand -hex 32
>    ```
> 3. **Hardware Controller TLS Verification:** While `OMADA_ALLOW_INSECURE_SSL=true` is supported for local lab controllers using self-signed certificates, production enterprise networks with valid controller CA certificates must set `OMADA_ALLOW_INSECURE_SSL=false` and provide trusted CA chains via `NODE_EXTRA_CA_CERTS`.
> 4. **Reverse-Proxy Rate Limiting:** Configure reverse proxy rate limiting (e.g. NGINX, Caddy, or Cloudflare) on `/api/auth/login` to restrict failed attempts to a maximum of 5 requests per IP per 5 minutes to prevent credential stuffing attacks.
> 5. **HTTP Security Headers:** Ensure the reverse proxy applies standard enterprise headers:
>    - `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';`
>    - `X-Content-Type-Options: nosniff`
>    - `X-Frame-Options: DENY`
>    - `Strict-Transport-Security: max-age=31536000; includeSubDomains`

---

## ⚙️ Environment Variables Reference

| Variable | Required in Prod | Default (Dev) | Description |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | Yes | `postgresql://postgres:postgres@localhost:5432/noc_dash` | PostgreSQL connection pool URI (falls back to in-memory in dev). |
| `JWT_SECRET` | Yes | `omada-noc-dashboard-super-secure-jwt-secret-key-32-chars` | HMAC-SHA256 secret key for signing session tokens (min 32 bytes). |
| `DEFAULT_ADMIN_EMAIL` | Optional | `admin@omadanoc.com` | Bootstrap administrator email address for initial seeding. |
| `DEFAULT_ADMIN_PASSWORD`| Optional | `AdminPass123!` | Bootstrap administrator initial password. |
| `OMADA_URL` | Yes | `192.168.100.2` | IP or hostname of the physical Omada SDN Controller. |
| `OMADA_USER` | Yes | — | Omada controller admin username / email. |
| `OMADA_PASS` | Yes | — | Omada controller admin password. |
| `OMADA_SITE` | No | `Default` | Omada site identifier. |
| `OMADA_ALLOW_INSECURE_SSL` | No | `true` | Set `false` in production with trusted CA certificates. |

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
