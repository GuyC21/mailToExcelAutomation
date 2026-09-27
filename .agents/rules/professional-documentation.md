---
name: professional-documentation
description: Ensures the agent always writes professional, standardized code documentation across the entire stack.
trigger: always_on
---

# Professional Code Documentation Rule

When writing or refactoring code in this project, you must strictly adhere to the following professional documentation standards. Documentation should be treated as a first-class citizen, equal in importance to the code itself.

## 1. Backend (Python/FastAPI)
*   **Docstrings:** Every module, class, and public function must have a clear docstring. Use the Google Python Style Guide for docstrings.
*   **API Endpoints:** API routes must document their purpose, expected payload, and return structures. Rely on FastAPI's native parameter typing and add descriptive docstrings that Swagger UI can pick up.
*   **Type Hints:** Use strict Python type hinting (`typing` module) for all function arguments and return values.

## 2. Frontend (React/JS)
*   **JSDoc/Component Signatures:** Document complex React components, custom hooks, and utility functions using standard JSDoc comments.
*   **Props:** Clearly describe the expected shape and purpose of component `props` (e.g., `isOpen`, `onConfirm`), especially since the project uses JavaScript instead of TypeScript.

## 3. General Best Practices (All Languages)
*   **The "Why", Not the "What":** Inline comments should explain *why* a particular technical decision, workaround, or algorithm was chosen, rather than just stating *what* the code is doing (which should be obvious from clean variable naming).
*   **Keep it DRY:** Avoid redundant comments that simply repeat the function name.
*   **Update Docs with Code:** Whenever you refactor existing code, you MUST update the accompanying docstrings/comments to reflect the new behavior.
