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

- **FirestorePostRepository**: Firestore implementation of PostRepository
- **FirestoreUserRepository**: Firestore implementation of UserRepository
- **FirestoreCommentRepository**: Firestore implementation of CommentRepository

`VoteRepository` has a port but does not yet have a Firestore adapter. The next
points-based Referenda milestone will add dedicated Referendum and ReferendumVote ports
and adapters; see
[`REFERENDA_POINTS_DEVELOPMENT_GUIDE.md`](../../docs/REFERENDA_POINTS_DEVELOPMENT_GUIDE.md).

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
