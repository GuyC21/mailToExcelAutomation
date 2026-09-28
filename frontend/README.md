# GoldenCare Frontend (Backoffice)

The frontend is a React Single Page Application (SPA) built with Vite and Tailwind CSS. It serves as the internal Backoffice UI for the finance and operations teams to monitor the system, review failed AI extractions, manage prompts, and run regression tests.

## Tech Stack
- **Framework**: React 18
- **Build Tool**: Vite (for fast HMR and optimized builds)
- **Styling**: Tailwind CSS
- **Layout**: Right-to-Left (RTL) out of the box, optimized for the Hebrew language interface.

## Project Structure

```
frontend/
├── src/
│   ├── api/          # Axios/fetch wrappers communicating with the FastAPI backend
│   ├── components/   # Reusable UI widgets (Modals, Forms, Cards) organized by feature
│   ├── layouts/      # Global layout wrappers (Sidebar, Header, Main content area)
│   ├── pages/        # Top-level route components
│   ├── App.jsx       # Routing definitions and global state setup
│   └── main.jsx      # React DOM entry point
├── public/           # Static assets
└── package.json      # Dependencies and scripts
```

## Key Pages

- **Dashboard (`DashboardPage.jsx`)**: Displays high-level metrics (total documents processed, success vs failure rates, total financial volume). It distinguishes between operational data (real emails) and test data (sandbox uploads).
- **Sandbox (`SandboxPage.jsx`)**: Allows users to manually drag-and-drop sample PDFs or images into the system to test the active AI extraction pipeline on the fly.
- **Review (`ReviewPage.jsx`)**: Shows a table of all processed documents. Users can filter by status (e.g., `NEEDS_REVIEW` or `FAILED`). When clicking a document, a split-screen view opens: the original PDF on one side, and the extracted data form on the other, allowing human operators to correct the AI's mistakes.
- **Regression Dashboard (`RegressionPage.jsx`)**: The command center for prompt testing. Users can select a prompt version, click "Run Suite", and view the detailed scoring report to see if the new prompt improved or degraded performance on historical documents.
- **Labeling (תיוג) (`LabelingPage.jsx`)**: The UI for adding new ground-truth documents to the regression suite. Users upload a difficult PDF and manually transcribe its exact values. This saves an expected JSON file on the backend, making the document a permanent part of the automated regression tests.
- **Prompts Management**: Handled via modals and cards (e.g., `PromptForm.jsx`, `PromptCard.jsx`). Allows the finance team to adjust the "Business Prompt" (the specific instructions given to the AI) without writing code.

## Component Architecture

Components are built to be self-contained and heavily utilize Tailwind for styling.
- **Layouts**: The UI relies on a responsive, RTL sidebar and top-nav layout.
- **Modals**: Extensively used for detailed views (`ViewModal.jsx`, `HistoryModal.jsx`) to avoid unnecessary page navigation and keep context.

## Local Development

1. Ensure the backend is running.
2. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
4. Access the UI at `http://localhost:5173`.

*Note: The Backoffice relies on `VITE_API_KEY` to authenticate against the backend if the backend has `BACKOFFICE_API_KEY` configured in its `.env`.*
