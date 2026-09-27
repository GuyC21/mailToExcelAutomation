# Architectural Excellence Rules

These rules are ALWAYS active for this project to ensure all code and designs meet the highest professional tier.

## 1. Clean Architecture & Separation of Concerns
- Maintain strict boundaries between the Domain logic, Application layer, and external concerns (Infrastructure, UI, Database).
- Dependencies must always point inward toward the core domain logic.

## 2. File Modularity & Preventing Bloat
- **One Class/Component per File**: Never group multiple distinct classes, interfaces, or components into a single file unless they are tiny and intimately tied together (e.g., a small data class used only by the main class).
- **File Length Limits**: Files should be kept small and focused. If a file begins to grow too large, aggressively refactor and split it into smaller, composable modules.
- **Function/Method Size**: Keep functions small and focused on a single task. Extract logic into private helper methods or separate services if a function becomes bloated.

## 3. SOLID Principles
- **Single Responsibility**: Classes and modules must have only one reason to change.
- **Open/Closed**: Software entities should be open for extension but closed for modification.
- **Liskov Substitution**: Subtypes must be completely substitutable for their base types.
- **Interface Segregation**: Prefer small, client-specific interfaces over large, general-purpose ones.
- **Dependency Inversion**: High-level modules must not depend on low-level modules; both should depend on abstractions.

## 4. Testability & Quality
- Write testable code from the start by using dependency injection and modular design.
- Validate inputs and handle errors gracefully using structured error reporting mechanisms.

## 5. Professional Code Standards
- Keep code DRY (Don't Repeat Yourself) but avoid premature abstractions.
- Document complex business logic, public APIs, and architectural decisions.
- Do not introduce "hacky" fixes or technical debt without explicit, documented justification.
