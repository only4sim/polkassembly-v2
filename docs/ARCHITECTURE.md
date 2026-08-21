# Polkassembly v2 - Architecture Documentation

## Overview

Polkassembly v2 follows a **Clean Architecture** pattern with domain-driven design principles, organized into distinct layers: Domain, Ports, Adapters, and Application (Next.js App Router).

## Directory Structure

```
src/
├── domain/           # Core business logic (entities, value objects, domain services)
├── ports/            # Interfaces/contracts for external dependencies
│   └── repositories/ # Repository interfaces (data access contracts)
├── adapters/         # Concrete implementations of ports
│   └── firestore/    # Firebase Firestore implementations
├── shared/           # Shared utilities and types (cross-layer)
└── app/              # Next.js App Router (UI layer - existing code)
```

## Dependency Rules

The architecture enforces strict dependency rules to maintain modularity and testability:

### 1. Domain Layer (Core)

- **Dependencies**: None (pure business logic)
- **Purpose**: Contains entities, value objects, and domain services
- **Rules**:
  - Must NOT depend on any other layer
  - Must NOT import framework-specific code (React, Next.js, Firebase)
  - Can only depend on language primitives and domain-specific types

### 2. Ports Layer (Contracts)

- **Dependencies**: Domain layer only
- **Purpose**: Defines interfaces/contracts for external dependencies
- **Rules**:
  - Can depend on domain entities/types
  - Must define abstract interfaces, NOT implementations
  - Examples: Repository interfaces, external service interfaces

### 3. Adapters Layer (Implementations)

- **Dependencies**: Ports + Domain + External libraries (Firebase, APIs, etc.)
- **Purpose**: Concrete implementations of port interfaces
- **Rules**:
  - Must implement port interfaces
  - Can use external libraries (firebase-admin, APIs, databases)
  - Should handle infrastructure concerns (serialization, error mapping)
  - Examples: FirestorePostRepository, AlgoliaSearchAdapter

### 4. Application Layer (Next.js App Router)

- **Dependencies**: Adapters + Ports + Domain + UI libraries (React, Next.js)
- **Purpose**: UI components, API routes, pages
- **Rules**:
  - Can depend on all other layers
  - Should use adapters through port interfaces (dependency injection)
  - **CRITICAL**: UI must NOT import Firebase SDK directly
  - Should call domain use cases or repositories via ports

## Module Boundaries

### Allowed Dependencies (Directional)

```
Domain ← Ports ← Adapters ← App
                          ↖ Shared (utilities)
```

### Prohibited Dependencies

- ❌ Domain → Ports/Adapters/App
- ❌ Ports → Adapters/App
- ❌ App → Firebase SDK directly (must go through adapters)

## Migration Strategy: Blockchain → Firebase

### Current State (2026-08-21)

- Domain entities exist for User, Post, Comment, Poll, and Vote.
- Repository ports exist for User, Post, Comment, and Vote.
- Firestore adapters exist for User, Post, and Comment; a Vote adapter is still missing.
- DemoOS APIs also use `demoPostService`, `demoCommentService`, and the legacy
  `src/app/api/_api-services/offchain_db_service/firestore_service/` path.
- Data access and business rules therefore remain partly coupled to Next.js/Firebase.

### Migration Path

#### Phase 1: Define Contracts (Mostly Complete)

1. ✅ Create repository interfaces in `ports/repositories/`
2. ✅ Example: `PostRepository.ts` interface

#### Phase 2: Implement Adapters (In Progress)

1. Create adapter implementations in `adapters/firestore/`
2. Migrate existing Firestore logic to adapter pattern
3. Example: `FirestorePostRepository.ts` implements `PostRepository`

#### Phase 3: Refactor API Routes (Not Started Systematically)

1. Update API routes to use repositories via dependency injection
2. Remove direct Firebase imports from API routes
3. Example:

   ```typescript
   // Before
   import { FirestoreService } from '@/app/api/_api-services/offchain_db_service/firestore_service';

   // After
   import { PostRepository } from '@/ports/repositories/PostRepository';
   import { FirestorePostRepository } from '@/adapters/firestore/FirestorePostRepository';

   const postRepo: PostRepository = new FirestorePostRepository();
   ```

#### Phase 4: Extract Domain Logic (Future)

1. Move business logic from API routes to domain services
2. Create use cases/interactors
3. Ensure domain layer is framework-agnostic

### Migration Checklist for Each Feature

- [ ] Define port interface
- [ ] Create adapter implementation
- [ ] Write tests for adapter
- [ ] Refactor API route to use adapter
- [ ] Remove direct Firebase imports
- [ ] Extract domain logic (if applicable)
- [ ] Update documentation

## Example: Post Management

### Port (Contract)

```typescript
// src/ports/repositories/PostRepository.ts
export interface PostRepository {
	getPostById(network: string, postId: number, type: string): Promise<Post | null>;
	createPost(post: CreatePostInput): Promise<Post>;
	updatePost(postId: number, updates: Partial<Post>): Promise<void>;
	deletePost(postId: number): Promise<void>;
}
```

### Adapter (Implementation)

```typescript
// src/adapters/firestore/FirestorePostRepository.ts
export class FirestorePostRepository implements PostRepository {
	async getPostById(network: string, postId: number, type: string): Promise<Post | null> {
		// TODO: Implement Firestore query logic
	}
}
```

### Usage in API Route

```typescript
// src/app/api/v1/posts/[id]/route.ts
import { PostRepository } from '@/ports/repositories/PostRepository';
import { FirestorePostRepository } from '@/adapters/firestore/FirestorePostRepository';

export async function GET(request: Request) {
	const postRepo: PostRepository = new FirestorePostRepository();
	const post = await postRepo.getPostById(network, postId, type);
	return Response.json(post);
}
```

## TypeScript Path Aliases

The following path aliases are configured in `tsconfig.json`:

```json
{
	"@/*": ["src/*"],
	"@domain/*": ["src/domain/*"],
	"@ports/*": ["src/ports/*"],
	"@adapters/*": ["src/adapters/*"],
	"@shared/*": ["src/shared/*"]
}
```

## Testing Strategy

### Unit Tests

- **Domain**: Test business logic in isolation
- **Adapters**: Test with mocked external dependencies

### Integration Tests

- Test adapters against real Firestore emulator
- Validate end-to-end data flow

### Contract Tests

- Verify adapters implement port interfaces correctly
- Use abstract test suites for repository contracts

## Benefits of This Architecture

1. **Testability**: Business logic can be tested without external dependencies
2. **Flexibility**: Easy to swap implementations (Firestore → PostgreSQL)
3. **Maintainability**: Clear separation of concerns
4. **Scalability**: New features follow established patterns
5. **Team Collaboration**: Different teams can work on different layers independently

## Data Model: `users/{uid}`

The `users` collection stores user profile documents keyed by Firebase Auth UID.

### Schema

| Field           | Type                | Default  | Description                                                |
| --------------- | ------------------- | -------- | ---------------------------------------------------------- |
| `uid`           | `string`            | —        | Firebase Auth UID (document ID)                            |
| `email`         | `string`            | `""`     | User's email address                                       |
| `displayName`   | `string`            | `""`     | User's display name                                        |
| `role`          | `'user' \| 'admin'` | `'user'` | User role; admin assigned manually via Firestore           |
| `pointsBalance` | `number`            | `1000`   | Voting eligibility and points-based Referenda voting power |
| `createdAt`     | `Timestamp`         | server   | Document creation timestamp                                |
| `updatedAt`     | `Timestamp`         | server   | Last-update timestamp                                      |

### Auto-Creation

The `onAuthUserCreated` Cloud Function (`auth.user().onCreate`) automatically
creates a `users/{uid}` document with default values when a new Firebase Auth user signs up.

### Domain Entity

```typescript
// src/domain/entities/User.ts
export interface User {
	uid: string;
	email: string;
	displayName: string;
	role: 'user' | 'admin';
	pointsBalance: number;
	createdAt: Date;
	updatedAt: Date;
}
```

### Repository Interface

```typescript
// src/ports/repositories/UserRepository.ts
export interface UserRepository {
	getUserByUid(uid: string): Promise<User | null>;
	createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User>;
	updateUser(uid: string, updates: Partial<Omit<User, 'uid' | 'createdAt'>>): Promise<void>;
	setRole(uid: string, role: 'user' | 'admin'): Promise<void>;
	getPointsBalance(uid: string): Promise<number>;
}
```

### Adapter

- `src/adapters/firestore/FirestoreUserRepository.ts` — Firestore implementation.

### API

- `GET /api/v2/users/me` — Returns the authenticated user's public profile.

## Next Architecture Milestone: Points-based Referenda

When `ENABLE_BLOCKCHAIN=true`, the existing Referenda code continues to use the current
on-chain/indexer path unchanged. When it is `false`, `/referenda` and
`/referenda/{index}` will use Firebase repositories and trusted server-side voting with
`pointsBalance` as voting power.

The application layer should select a provider at the route boundary. Shared UI receives
normalized listing/detail/vote view models and must not decide whether data came from the
chain or Firestore. Points voting must not import wallet, Polkadot API, conviction,
delegation, or chain transaction modules.

See [`REFERENDA_POINTS_DEVELOPMENT_GUIDE.md`](./REFERENDA_POINTS_DEVELOPMENT_GUIDE.md)
for the target data model, ports, API contracts, UI reuse map, implementation phases, and
test requirements.

## References

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Hexagonal Architecture (Ports & Adapters)](https://alistair.cockburn.us/hexagonal-architecture/)
- [Domain-Driven Design](https://martinfowler.com/tags/domain%20driven%20design.html)
