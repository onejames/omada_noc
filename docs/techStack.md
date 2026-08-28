# Technology Stack & Job Alignment

This document maps the chosen technologies directly to the stated requirements and preferences of the GlobalNOC Software & Network Engineer position.

---

## Architecture Topology
- **Physical Network Device:** TP-Link Omada SDN Hardware Controller Appliance (`192.168.100.2`), managing 14 real network infrastructure devices (9 EAP Access Points, 4 JetStream Switches, 1 Multi-WAN Gateway) and 70+ client devices.
- **Application Platform:** Full-stack Next.js 16 + React 19 + TypeScript + 5-Tool Model Context Protocol (MCP) Server.
- **Database & Persistence:** Dual-Mode PostgreSQL 16 / In-Memory Store managing users, extended profiles, device tags, and paginated login audits.
- **Containerization Target:** Podman (Rootless Linux Container Runtime) & Docker (OCI compatible).
- **Orchestration & Declarative Config:** Compose (`compose.yaml`) and Kubernetes with Kustomize (`k8s/`).

---

## 1. Next.js 16, React 19, & Tailwind CSS v4

- **Role in Project:** Frontend visualization, API routing, SSR initial telemetry fetch, Next.js 16 Edge Proxy (`proxy.ts`), interactive client components, and user management screens.
- **GlobalNOC Alignment:**
  - *Requirement:* "Provides advanced research/analysis and stays up-to-date on new industry software development standards, emerging technology, UX/UI design/philosophy."
  - *Requirement:* "Visualizations to help end users understand their data."
- **Justification:** Next.js is the modern standard for full-stack React applications. Tailwind v4 delivers rapid, maintainable styling and dark-mode ergonomics optimized for high-density NOC telemetry screens without unnecessary boilerplate.

---

## 2. PostgreSQL & Production-Grade AuthN/AuthZ (RBAC)

- **Role in Project:** Secure persistence layer managing users, extended profiles, multi-tenant device tags, and paginated authentication audit trails (`user_logins`).
- **GlobalNOC Alignment:**
  - *Requirement:* "Provides advanced design, development, testing, and configuration of software systems... tuning of new and existing software."
  - *Requirement:* "IT service management... IT systems security and user access control."
- **Justification:** Demonstrates enterprise-grade software architecture: parameterized queries (preventing SQL injection), salted password hashing (`bcryptjs`), stateless signed JWT cookies (`jose` with HMAC-SHA256 JWS), 15-minute inactivity session expiration, and dynamic device-level multi-tenant scoping.

---

## 3. Model Context Protocol (MCP) & AI Copilot Integration

- **Role in Project:** Exposes live network state and active client telemetry to LLMs (Claude Desktop, custom agents) via 5 specialized tools (`get_network_status`, `get_active_clients`, `get_network_devices`, `get_client_detail`, `audit_network_health`).
- **GlobalNOC Alignment:**
  - *Preferred:* "Experience with programmatic use of LLMs, AI, and related systems. Integration of data sources into LLMs via MCP or similar protocols."
- **Justification:** Directly fulfills a highly specific and advanced preferred qualification. Demonstrates the ability to bridge hardware-level network telemetry with modern agentic AI workflows, including automated diagnostic auditing and interactive terminal copilot querying.

---

## 4. Podman & Docker (Containerization)

- **Role in Project:** Packaging and deploying the `noc_dash` full-stack application and MCP server bridge in a secure, rootless container alongside PostgreSQL.
- **GlobalNOC Alignment:**
  - *Preferred:* "Experience with application containerization platforms such as docker and podman."
- **Justification:** While Docker is standard, deliberately supporting Podman demonstrates direct alignment with enterprise Linux environments (RHEL, Rocky, Alma) and rootless container security principles.

---

## 5. Kubernetes & Kustomize

- **Role in Project:** Declarative cloud-native deployment manifests ([`k8s/deployment.yaml`](file:///Users/jameslaster/Code/posh/noc_dash/k8s/deployment.yaml), [`k8s/service.yaml`](file:///Users/jameslaster/Code/posh/noc_dash/k8s/service.yaml), [`k8s/kustomization.yaml`](file:///Users/jameslaster/Code/posh/noc_dash/k8s/kustomization.yaml)).
- **GlobalNOC Alignment:**
  - *Preferred:* "Experience with kubernetes application deployment methods such as helm or kustomize."
- **Justification:** Demonstrates production readiness for scaling telemetry monitoring in container orchestrators with structured health probes and secret generation.

---

## 6. Node.js & TypeScript (Physical Omada Controller API Engine)

- **Role in Project:** Backend integration engine communicating directly with the physical Omada hardware controller at `192.168.100.2`.
- **GlobalNOC Alignment:**
  - *Requirement:* "Provides advanced design, development, testing, and configuration of software systems... tuning of new and existing software."
  - *Requirement:* "Network measurement, monitoring, visualization."
- **Justification:** Demonstrates senior engineering craftsmanship: reverse-engineering Omada v5.15 API handshakes (two-step auth, CSRF tokens, session cookies, dynamic site resolution for `"The Farm"`), strict TypeScript data modeling, and robust automated test suites.

---

## 7. Testing & Quality Assurance Suite (Vitest & V8)

- **Role in Project:** Comprehensive automated testing enforcing strict code coverage thresholds (**> 97% coverage**, 162+ tests across 20 test suites).
- **GlobalNOC Alignment:**
  - *Requirement:* "Makes recommendations to improve, as well as implements, testing, quality assurance, and documentation protocols and procedures for websites and web applications."
  - *Requirement:* "Demonstrates a high commitment to quality."
- **Justification:** Automated build gates prevent regression by halting builds if any test fails or coverage drops, backed by a live hardware diagnostic tool for continuous telemetry verification.