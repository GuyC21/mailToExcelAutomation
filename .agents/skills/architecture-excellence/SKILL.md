---
name: architecture-excellence
description: >-
  Use this skill when designing a new feature, creating an implementation plan, or reviewing the system's architecture to ensure it meets the highest professional tier.
---

# Architecture Excellence Skill

This skill provides a structured workflow for ensuring the highest level of professional software architecture. Use it when formulating plans or conducting architectural reviews.

## Workflow: Architectural Design & Review

When activated, follow these steps to validate or produce architectural designs:

### Step 1: Component Boundary Analysis
- Identify the core domain, the application services, and the infrastructure adapters.
- **Validation**: Ensure that infrastructure (DB, UI, External APIs) depends on the domain, not the other way around. 

### Step 2: Dependency Injection & Inversion Check
- Check if concrete classes are tightly coupled.
- **Action**: Introduce interfaces or abstract base classes where dependencies cross boundaries, ensuring modules can be mocked for unit testing.

### Step 3: File Modularity & Bloat Check
- Ensure that each file is focused on a single class, interface, or distinct component.
- **Action**: If any file or function is becoming too large or taking on multiple responsibilities, break it down into smaller, composable modules or helper files.

### Step 4: Design Pattern Applicability
- Evaluate if standard Gang of Four (GoF) patterns or architectural patterns (CQRS, Event Sourcing, Factory, Strategy) can simplify the design.
- **Warning**: Do not over-engineer. Only suggest patterns if they solve an identified scalability, flexibility, or complexity problem.

### Step 4: Scalability & Resilience Review
- Assess the architecture for potential bottlenecks.
- Check for resilient error handling (e.g., retries, circuit breakers, fallback mechanisms) in distributed or external-facing components.

### Step 5: Deliverable
- If reviewing, produce an `architecture_review.md` artifact detailing violations and concrete refactoring steps.
- If designing, incorporate these principles explicitly into the `implementation_plan.md` and detail how the layers will interact.
