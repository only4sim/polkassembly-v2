# Ports Layer

This directory defines interfaces and contracts for external dependencies.

## Purpose

Ports are abstractions that define:

- **Repository Interfaces**: Data access contracts (PostRepository, UserRepository)
- **Service Interfaces**: External service contracts (NotificationService, SearchService)
- **Gateways**: API client interfaces for third-party services

## Rules

- Only interfaces/abstract classes (NO implementations)
- Can depend on Domain layer types
- Must NOT depend on Adapters or App layers

## Current Ports

- **PostRepository**: Contract for post data access operations

## Example Structure

```
ports/
├── repositories/
│   ├── PostRepository.ts
│   ├── UserRepository.ts
│   └── CommentRepository.ts
└── services/
    ├── NotificationService.ts
    └── SearchService.ts
```
