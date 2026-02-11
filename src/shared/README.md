# Shared Layer

This directory contains shared utilities and types used across all layers.

## Purpose

Shared utilities include:

- **Common Types**: Cross-cutting type definitions
- **Utility Functions**: Pure helper functions (formatters, validators)
- **Constants**: Application-wide constants

## Rules

- Should be pure utilities with no side effects
- Can be imported by any layer
- Should NOT contain business logic (that belongs in Domain)

## Note

The existing `/src/_shared/` directory already serves this purpose and contains extensive types and utilities. This new `/src/shared/` directory can be used for new architecture-aligned utilities.

## Example Structure

```
shared/
├── types/
│   └── common.ts
├── utils/
│   ├── formatters.ts
│   └── validators.ts
└── constants/
    └── config.ts
```
