# Adapters Layer

This directory contains concrete implementations of port interfaces.

## Purpose

Adapters provide:

- **Repository Implementations**: Firestore, PostgreSQL, in-memory implementations
- **Service Implementations**: Real or mock implementations of external services
- **Infrastructure Code**: Database connections, API clients, caching

## Rules

- Must implement port interfaces
- Can use external libraries (firebase-admin, axios, etc.)
- Can depend on Ports and Domain layers
- Must NOT be imported directly by Domain or Ports layers

## Current Adapters

- **FirestorePostRepository**: Firestore implementation of PostRepository (stub with TODOs)

## Example Structure

```
adapters/
├── firestore/
│   ├── FirestorePostRepository.ts
│   ├── FirestoreUserRepository.ts
│   └── FirestoreConnection.ts
├── postgresql/
│   └── PostgresPostRepository.ts
├── algolia/
│   └── AlgoliaSearchService.ts
└── in-memory/
    └── InMemoryPostRepository.ts (for testing)
```
