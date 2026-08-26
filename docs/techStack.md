# Technology Stack & Job Alignment

This document maps the chosen technologies directly to the stated requirements and preferences of the GlobalNOC Software & Network Engineer position.

---

## Architecture Topology
- **Physical Network Device:** TP-Link Omada SDN Hardware Controller Appliance (`192.168.100.2`), managing real network infrastructure (EAP Access Points, JetStream Switches, Gateway, 70+ client devices).
- **Application Platform:** Full-stack Next.js 16 + React 19 + TypeScript + Model Context Protocol (MCP).
- **Containerization Target:** Podman (Rootless Linux Container Runtime) & Docker (OCI compatible).
- **Orchestration & Declarative Config:** Compose (`compose.yaml`) and Kubernetes with Kustomize (`k8s/`).

---

## 1. Next.js 16, React 19, & Tailwind CSS v4

- **Role in Project:** Frontend visualization, API routing, SSR initial telemetry fetch, and interactive client components.
- **GlobalNOC Alignment:**
  - *Requirement:* "Provides advanced research/analysis and stays up-to-date on new industry software development standards, emerging technology, UX/UI design/philosophy."
  - *Requirement:* "Visualizations to help end users understand their data."
- **Justification:** Next.js is the modern standard for full-stack React applications. Tailwind v4 delivers rapid, maintainable styling and dark-mode ergonomics optimized for high-density NOC telemetry screens without unnecessary boilerplate.

---

## 2. Model Context Protocol (MCP)

- **Role in Project:** Exposes live network status and active client telemetry to LLMs (Claude Desktop) via standardized tools (`get_network_status`, `get_active_clients`).
- **GlobalNOC Alignment:**
  - *Preferred:* "Experience with programmatic use of LLMs, AI, and related systems. Integration of data sources into LLMs via MCP or similar protocols."
- **Justification:** Directly fulfills a highly specific and advanced preferred qualification. Demonstrates the ability to bridge hardware-level network telemetry with modern agentic AI workflows.

---

## 3. Podman (Containerization)

- **Role in Project:** Packaging and deploying the `noc_dash` full-stack application and MCP server bridge in a secure, rootless container.
- **GlobalNOC Alignment:**
  - *Preferred:* "Experience with application containerization platforms such as docker and podman."
- **Justification:** While Docker is standard, deliberately choosing Podman demonstrates direct alignment with enterprise Linux environments (RHEL, Rocky, Alma) and rootless container security principles.

---

## 4. Kubernetes & Kustomize

- **Role in Project:** Declarative cloud-native deployment manifests ([`k8s/deployment.yaml`](file:///Users/jameslaster/Code/posh/noc_dash/k8s/deployment.yaml), [`k8s/service.yaml`](file:///Users/jameslaster/Code/posh/noc_dash/k8s/service.yaml), [`k8s/kustomization.yaml`](file:///Users/jameslaster/Code/posh/noc_dash/k8s/kustomization.yaml)).
- **GlobalNOC Alignment:**
  - *Preferred:* "Experience with kubernetes application deployment methods such as helm or kustomize."
- **Justification:** Demonstrates production readiness for scaling telemetry monitoring in container orchestrators with structured health probes and secret generation.

---

## 5. Node.js & TypeScript (Physical Omada Controller API Engine)

- **Role in Project:** Backend integration engine communicating directly with the physical Omada hardware controller at `192.168.100.2`.
- **GlobalNOC Alignment:**
  - *Requirement:* "Provides advanced design, development, testing, and configuration of software systems... tuning of new and existing software."
  - *Requirement:* "Network measurement, monitoring, visualization."
- **Justification:** Demonstrates senior engineering craftsmanship: reverse-engineering Omada v5.15 API handshakes (two-step auth, CSRF tokens, session cookies, dynamic site resolution for `"The Farm"`), strict TypeScript data modeling, and robust automated test suites with > 99% coverage.

---

## 6. Testing & Quality Assurance Suite (Vitest & V8)

- **Role in Project:** Comprehensive automated testing enforcing strict code coverage thresholds (**> 99% coverage**, 63 tests).
- **GlobalNOC Alignment:**
  - *Requirement:* "Makes recommendations to improve, as well as implements, testing, quality assurance, and documentation protocols and procedures for websites and web applications."
  - *Requirement:* "Demonstrates a high commitment to quality."
- **Justification:** Automated build gates prevent regression by halting builds if any test fails or coverage drops, backed by a live hardware diagnostic tool for continuous telemetry verification.