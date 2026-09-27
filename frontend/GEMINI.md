# React Frontend Architectural Guidelines

This project strictly adheres to the following principles for all frontend code:

1. **The "Orchestrator" Pattern (Strict Separation of Concerns)**
   - **Pages (`src/pages/`)**: Pages must act STRICTLY as "Orchestrators". They should only subscribe to custom hooks for data, manage high-level modal state, and arrange child components in a layout grid. They must *not* contain raw `fetch` calls, complex business logic, or large inline forms.
   - **Components (`src/components/`)**: UI elements (Forms, Cards, Modals) must be fully isolated. If a component is complex (like a Form with internal state), it should manage its own internal state and communicate with the Orchestrator via callbacks (e.g., `onSuccess`).
   - **Custom Hooks (`src/hooks/`)**: All network calls (API fetching, POST, DELETE) and complex state management must be extracted into custom React hooks (e.g., `usePrompts`).

2. **Zero Bloat & Modularity**
   - No single file should exceed 150 lines. If it does, strictly evaluate what logic can be extracted into a Hook or a sub-component.

3. **Responsive & Reflexive UI**
   - Ensure all components look perfect on mobile devices first (`flex-col`, small padding) and scale up gracefully for tablets and desktops using Tailwind prefixes (`md:`, `lg:`).
