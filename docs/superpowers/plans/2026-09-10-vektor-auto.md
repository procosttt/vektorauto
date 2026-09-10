# Vektor Auto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a premium responsive Vektor Auto landing page with a real, protected application flow into the existing n8n automation.

**Architecture:** A dependency-free Node.js server serves a static HTML/CSS/JS interface and relays validated leads to n8n. The updated workflow adds a website webhook and links a submitted lead to Telegram by an opaque request identifier.

**Tech Stack:** HTML5, CSS, browser JavaScript, Node.js 20+ standard library, n8n workflow JSON

**Spec:** `docs/superpowers/specs/2026-09-10-vektor-auto-design.md`

## Global Constraints

- Do not add a frontend framework or runtime dependency.
- Do not expose n8n URL or token to the browser.
- Do not invent reviews, ratings, business statistics, address, or phone.
- Keep the project explicitly marked as a portfolio demonstration.
- Preserve the original n8n Form Trigger and Telegram flow.
- Do not add accounts, payments, CRM, blog, or CMS.

---

### Task 1: Lead gateway

**Files:**
- Create: `lib/lead.mjs`
- Create: `server.mjs`
- Create: `.env.example`
- Create: `.gitignore`
- Test: `test/lead.test.mjs`

**Interfaces:**
- Consumes: JSON `{name, phone, car, problem, desired_date, desired_time, consent, website}`
- Sends: normalized JSON with `request_id` to `N8N_WEBHOOK_URL`
- Returns: `{ok, requestId, telegramUrl}` without secrets

- [ ] Write tests for invalid input, honeypot, missing environment, duplicate request, and successful relay.
- [ ] Run the tests and confirm they fail.
- [ ] Implement validation, rate limiting, deduplication, n8n relay, and Telegram URL generation.
- [ ] Implement the local static server and minimal `.env` loader.
- [ ] Run the tests and confirm they pass.

### Task 2: Responsive landing page

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `app.js`
- Create: `assets/hero-car.webp`

**Interfaces:**
- Calls: `POST /api/lead`
- Opens: `/telegram` before submission and returned deep link after submission

- [ ] Build semantic page structure and accessible form states.
- [ ] Add the original hero asset and responsive industrial visual system.
- [ ] Add native client validation, submit locking, and success/error panels.
- [ ] Check desktop and 390 px mobile layouts in a real browser.

### Task 3: n8n portfolio workflow

**Files:**
- Create: `workflow/Vektor-Auto-V2.3-Website-Demo.json`
- Create: `scripts/build-workflow.mjs`
- Test: `test/workflow.test.mjs`

**Interfaces:**
- Adds: authenticated POST webhook `vektor-auto-lead`
- Adds: `request_id` persistence and Telegram `/start site_<request_id>` linking
- Preserves: current form, admin approval, Calendar, reminder, report, and error flows

- [ ] Write a structural workflow test.
- [ ] Build V2.3 deterministically from the supplied V2.2 export.
- [ ] Verify required nodes, connections, request identifier mapping, and absence of embedded secrets.

### Task 4: Handoff documentation and final verification

**Files:**
- Create: `README.md`
- Create: `docs/DEMO-SCRIPT.md`
- Create: `package.json`

- [ ] Document n8n import, Data Table column, Header Auth, `.env`, local run, and future Vercel deployment.
- [ ] Document the complete five-minute portfolio demonstration.
- [ ] Run all automated checks.
- [ ] Test the form against a local mock webhook.
- [ ] Inspect desktop and mobile screenshots and fix visible defects.
