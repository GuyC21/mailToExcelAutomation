---
name: responsive-design
description: >-
  Use this skill to ensure that all UI pages and components are fully responsive, mobile-friendly, and adaptable to tablets using CSS/Tailwind reflexive design principles.
---

# Responsive Design Skill

This skill guarantees that every frontend interface built in this project provides a seamless experience across all device sizes (Mobile, Tablet, Desktop).

## Core Principles

1. **Mobile-First Approach**: Always design the base classes for mobile devices first. Use Tailwind's `sm:`, `md:`, `lg:`, and `xl:` prefixes to scale the design up for tablets and desktops.
2. **Flexible Grids & Flexbox**: Avoid hardcoded widths (like `w-96`) and instead prefer percentages, `w-full`, and flexible grid columns (e.g., `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`).
3. **Reflexive Design**: UI elements should reflow naturally. Menus should collapse into hamburger icons on mobile, tables should become horizontally scrollable or stack vertically, and padding should adjust dynamically (e.g., `p-4 md:p-8`).

## Workflow: Applying Responsive Design

When generating or refactoring a page:
1. **Analyze Layout Requirements**: Identify elements that need to stack on mobile (e.g., side-by-side forms, dashboards).
2. **Apply Base (Mobile) Tailwind Classes**: e.g., `flex-col`, `gap-4`, `text-base`.
3. **Apply Tablet/Desktop Overrides**: e.g., `md:flex-row`, `md:gap-8`, `lg:text-lg`.
4. **Test & Verify (Mental Check)**: Ensure there are no absolute positionings or fixed widths that would cause horizontal scrolling or overflowing on a 320px screen.
