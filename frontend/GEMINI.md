# React Frontend Architectural Guidelines

This project strictly adheres to the following principles for all frontend code:

1. **Separation of Concerns (SoC)**
   - **Pages (`src/pages/`)**: High-level views that orchestrate state, fetch data from the API, and assemble components. Pages should *not* contain complex DOM elements.
   - **Components (`src/components/`)**: Pure, reusable, and dumb UI elements (e.g., Modals, Buttons, Cards) that receive data via props and emit events via callbacks.
   - **Layouts (`src/layouts/`)**: Wrappers for shared structural elements (navigation, footers).

2. **Zero Bloat & Modularity**
   - No single file should exceed 150-200 lines if it can be reasonably broken down.
   - Move complex business logic or data fetching into custom hooks (`src/hooks/`) or utility files (`src/utils/`).

3. **Responsive & Reflexive UI**
   - Ensure all components look perfect on mobile devices first (`flex-col`, small padding) and scale up gracefully for tablets and desktops using Tailwind prefixes (`md:`, `lg:`).
