# Product Requirements Document (PRD)

- **Project Name:** Omada NOC Dashboard & MCP Bridge
- **Target:** GlobalNOC Software & Network Engineer Interview (Sept 10)
- **Deployment Model:** Containerized Full-Stack Application with PostgreSQL Persistence

## 1. Executive Summary

The objective of this project is to build a production-grade, full-stack observability and management platform that interfaces with a live, **physical TP-Link Omada Hardware Controller appliance** (`192.168.100.2`) managing 14 physical devices (9 APs, 4 Switches, 1 Gateway) and 70+ client devices. 

The system features **real Authentication & Role-Based Access Control (RBAC)** backed by **PostgreSQL**, multi-tenant **device tagging**, an **admin user directory with paginated login audits**, a customizable **user profile system with inactivity auto-logout**, and exposes live network state to Large Language Models via the **Model Context Protocol (MCP)**.

## 2. Goals & Success Criteria

- **Hardware Network Integration:** Authenticate directly with the physical Omada SDN Hardware Controller at `192.168.100.2` and ingest live telemetry across infrastructure and client devices.
- **Production-Grade AuthN & AuthZ (RBAC):** Implement PostgreSQL-backed user management, salted password hashing (`bcryptjs`), secure JWT sessions (`jose`), and 15-minute inactivity timeouts.
- **Multi-Tenant Device Tagging & Scoping:** Scopes regular user dashboards to their tagged devices, while granting untagged users and administrators full visibility.
- **Admin Audit Trail:** Capture all authentication attempts in a `user_logins` table with paginated browsing (10 records/page).
- **User Profile Management & Widget:** Provide a top-right corner profile widget, `/profile` management page, display customization, and password updates.
- **Satisfy AI/LLM Requirements:** Expose 5 specialized MCP tools and an interactive copilot for live network diagnosis and tuning suggestions.
- **Maintainability & Reliability:** Maintain strict TypeScript types, 98%+ automated test coverage with Vitest, and clean documentation.

## 3. Core Features

### A. Authentication & Access Control
- **PostgreSQL Persistence:** Tables for `users`, `user_profiles`, `user_device_tags`, and `user_logins`.
- **RBAC Engine:** Distinct permissions for `ADMIN` and `USER` roles.
- **Inactivity Protection:** 15-minute inactivity timer with automated session invalidation and redirect to login.
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

### E. Model Context Protocol (MCP) Bridge
- **5 Core Tools:** `get_network_status`, `get_active_clients`, `get_network_devices`, `get_client_detail`, and `audit_network_health`.
- **Interactive CLIs:** `npm run mcp:copilot` (REPL), `npm run mcp:agent` (Demo), and `npm run mcp:inspect` (Visual GUI).

## 4. Out of Scope

- Omada controller hardware configuration mutation (read-only monitoring for safe observability).
- Multi-controller federation (focused on single physical controller with dynamic site resolution).