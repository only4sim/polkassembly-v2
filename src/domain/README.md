# Domain Layer

This directory contains the core business logic and domain entities.

## Purpose

The domain layer is the heart of the application, containing:

- **Entities**: Core business objects (e.g., Post, User, Comment)
- **Value Objects**: Immutable types representing domain concepts
- **Domain Services**: Business logic that doesn't belong to a single entity

## Rules

- NO external dependencies (frameworks, libraries)
- Pure TypeScript/JavaScript code
- Framework-agnostic (no React, Next.js, Firebase imports)
- Must NOT depend on Ports, Adapters, or App layers

## Example Structure (Future)

```
domain/
├── entities/
│   ├── Post.ts
│   ├── User.ts
│   └── Comment.ts
├── value-objects/
│   ├── Network.ts
│   └── ProposalType.ts
└── services/
    ├── VotingService.ts
    └── DelegationService.ts
```
