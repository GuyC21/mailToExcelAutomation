# BillingStream Frontend (Backoffice)

The frontend is a React Single Page Application (SPA) built with Vite and Tailwind CSS v4. It serves as the internal Backoffice UI for finance, operations, and admin teams to monitor extractions, review/correct flagged documents, manage prompts, run regression benchmarks, and approve users.

## Tech Stack
- **Framework**: React 19 + React Router v7
- **Build Tool & Linter**: Vite 8 + `oxlint`
- **Styling**: Tailwind CSS v4 + Recharts 3
- **Auth SDK**: `@supabase/supabase-js` v2 (Supabase GoTrue JWT + ephemeral BYOK via `sessionStorage`)
- **Layout**: Right-to-Left (RTL) out of the box, optimized for a Hebrew-first interface across mobile, tablet, and desktop viewports.

## Project Structure (`<= 150` lines per file, Orchestrator pattern)

```text
frontend/
├── src/
│   ├── api/          # API fetch/Blob wrappers (client.js) and Supabase client setup
│   ├── components/   # Feature-grouped UI widgets (admin, auth, byok, dashboard, layout, regression, review, sandbox)
│   ├── context/      # Global providers (AuthContext, BYOKContext) and shared React Context objects
│   ├── hooks/        # Domain custom hooks encapsulating network calls and stateful lifecycles
│   ├── pages/        # Top-level route Orchestrators (subscribe to hooks, compose components)
│   └── utils/        # Pure formatters, BYOK storage helpers, auth translation, and form mappers
├── public/           # Static public directory
└── package.json      # Dependencies and scripts
```

## Key Pages

- **Auth & Access (`LoginPage.jsx`, `RegisterPage.jsx`, `PendingApprovalPage.jsx`, `UserManagementPage.jsx`)**: Email/password login and signup via Supabase Auth, pending-approval holding view, and admin user lifecycle console (`APPROVED` / `REJECTED` / `SUSPENDED`).
- **Dashboard (`DashboardPage.jsx`)**: Per-currency KPIs, operational vs test filtering (`includeTests`), status/channel/provider breakdowns, and authenticated Excel export/sync.
- **Sandbox (`SandboxPage.jsx`)**: Single-file upload and multi-format simulated inbound email composer with user-scoped in-flight job polling and live Excel preview.
- **Review (`ReviewPage.jsx`)**: Filterable document queue with authenticated Blob PDF/image previews (no query-string JWT leaks) and editable extraction fields with live mathematical revalidation.
- **Regression (`RegressionPage.jsx`)**: Run benchmark suites against active or draft prompts (using BYOK keys), inspect persisted run history, and compare two runs side by side (A/B).
- **Labeling (`LabelingPage.jsx`)**: Transcribe and save paired ground-truth document + `_expected.json` cases directly to the backend regression suite.
- **Prompts (`HomePage.jsx`)**: Create, duplicate, activate, AI-enhance (BYOK), and inspect composed System Envelope prompts.

## Local Development

1. Ensure the FastAPI backend is running.
2. Configure environment variables in `frontend/.env` as needed:
   - `VITE_API_URL` (default `http://localhost:8000`)
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (when Supabase auth is enabled)
3. Install dependencies and run dev/checks:
   ```bash
   cd frontend
   npm install
   npm run dev
   npm run lint
   npm run build
   ```
4. Access the UI at `http://localhost:5173`.
