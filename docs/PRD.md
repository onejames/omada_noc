# Product Requirements Document (PRD)

- **Project Name:** Omada NOC Dashboard & MCP Bridge
- **Target:** GlobalNOC Software & Network Engineer Interview (Sept 10)
- **Deployment Model:** Containerized Full-Stack Application with PostgreSQL / In-Memory Dual-Mode Persistence

## 1. Executive Summary

The objective of this project is to build a production-grade, full-stack observability and management platform that interfaces with a live, **physical TP-Link Omada Hardware Controller appliance** (`192.168.100.2`) managing 14 physical devices (9 APs, 4 Switches, 1 Gateway) and 70+ client devices. 

The system features **real Authentication & Role-Based Access Control (RBAC)** backed by **PostgreSQL** (with transparent development fallback), multi-tenant **device tagging**, an **admin user directory with paginated login audits**, a customizable **user profile system with inactivity auto-logout**, Next.js 16 Edge Proxy protection (`proxy.ts`), and exposes live network state to Large Language Models via the **Model Context Protocol (MCP)**.

## 2. Goals & Success Criteria

- **Hardware Network Integration:** Authenticate directly with the physical Omada SDN Hardware Controller at `192.168.100.2` and ingest live telemetry across infrastructure and client devices.
- **Production-Grade AuthN & AuthZ (RBAC):** Implement PostgreSQL-backed user management, salted password hashing (`bcryptjs`), secure signed JWT sessions (`jose` HMAC-SHA256 JWS), and 15-minute inactivity timeouts.
- **Multi-Tenant Device Tagging & Scoping:** Scopes regular user dashboards to their tagged devices, while granting untagged users (Open Read Fallback) and administrators full visibility.
- **Admin Audit Trail:** Capture all authentication attempts in a `user_logins` table with paginated browsing (10 records/page).
- **User Profile Management & Widget:** Provide a top-right corner profile widget, `/profile` management page, display customization, and password updates.
- **Satisfy AI/LLM Requirements:** Expose 5 specialized MCP tools and an interactive copilot for live network diagnosis and tuning suggestions.
- **Maintainability & Reliability:** Maintain strict TypeScript types, 97%+ automated test coverage with Vitest, and clean enterprise documentation.

## 3. Core Features

### A. Authentication & Access Control
- **Dual-Mode Persistence:** PostgreSQL 16 connection pooling with transparent fallback to in-memory store in local development.
- **RBAC Engine:** Distinct permissions for `ADMIN` and `USER` roles enforced across Edge Proxy, SSR Server Components, and API routes.
- **Inactivity Protection:** 15-minute sliding inactivity timer with automated session invalidation and redirect to login.
- **Default Bootstrap:** Automated database auto-seeding with generic administrator credentials (`admin@omadanoc.com` / `AdminPass123!`).

### B. User Management & Device Scoping
- **Admin User Directory (`/admin/users`):** Manage accounts, assign roles, reset credentials, and delete users.
- **Interactive Device Tagging Matrix:** Assign physical client devices (by MAC address) to users with custom device aliases.
- **Paginated Login Audits:** Browse 10 login attempts per page with timestamp, client IP, user agent, and status.

### C. Profile Management & Header Widget
- **Top-Right Profile Widget:** Shows user avatar, display name, role badge, quick links to profile and admin screens, and logout.
- **Profile Edit Page (`/profile`):** Edit personal info, job title, department, theme preference, and change password.

### D. Telemetry Dashboard (UI)
- **Scoped Telemetry View:** Dynamically filters clients and recalculates KPI aggregate cards based on user's tagged devices.
- **Live Auto-Polling & Filters:** 5s Live, 10s, 30s intervals, search query, medium filters (All / Wi-Fi / Ethernet), and sorting.

### E. Executive PDF Reporting & Telemetry Aggregation
- **Executive Summary Data Aggregation (`GET /api/reports/summary`):** Live telemetry aggregation spanning Top 5 active devices by instantaneous throughput (Mbps), Top 5 heavy consumers by cumulative session volume (MB/GB), Top 5 active system operators, and 4-tier RF signal distribution (Excellent, Good, Fair, Poor).
- **1-Click Vector PDF Export (`jspdf` + `jspdf-autotable`):** Zero-Chromium vector PDF generator producing styled executive briefing dossiers with KPI metric cards, data tables, and cryptographic verification metadata.
- **Reports Modal (`ReportsModal.tsx`):** Interactive modal on the main dashboard with tabbed views and 1-click PDF download.

### F. Continuous Memory Iterative AI Insights Engine
- **Stateful Diagnostic Memory (`ai_insights_history`):** Persistent audit storage enabling the AI to learn system trajectory and track state across successive runs.
- **Comparative Trend Logic:** Automatically classifies network status as `INITIAL` baseline, `IMPROVED` (+delta%), `DEGRADED` (-delta%), or `STABLE` ($\pm 2\%$).
- **Chronic Issue Persistence:** Flags unresolved issues with persistence counters and tracks resolved issues over time.
- **Admin AI Insights Drawer (`AiInsightsDrawer.tsx`):** Slide-over diagnostic console featuring historical health score trajectory sparklines, categorized issue tabs, and on-demand AI audit trigger.

### G. Model Context Protocol (MCP) Bridge
- **6 Core Tools:** `get_network_status`, `get_active_clients`, `get_network_devices`, `get_client_detail`, `audit_network_health`, and `get_audit_history`.
- **Interactive CLIs:** `npm run mcp:copilot` (REPL), `npm run mcp:agent` (Demo), and `npm run mcp:inspect` (Visual GUI).

## 4. Out of Scope

- Omada controller hardware configuration mutation (read-only monitoring for safe observability).
- Multi-controller federation (focused on single physical controller with dynamic site resolution).