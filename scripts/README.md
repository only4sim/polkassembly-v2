# Test Data Scripts

Scripts for populating the Firebase emulator with test data for manual testing.

## Prerequisites

1. Start the Firebase emulator:

   ```bash
   firebase emulators:start --only firestore,auth
   ```

2. Keep the emulator running in a separate terminal while using these scripts.

## Scripts

### populate-test-data.ts

Creates a complete test dataset:

- 25 test users with varying points balances
- 1 test referendum
- 25 votes (one per user, with different decisions and points)
- 25 comments from different users

**Usage:**

```bash
npx tsx scripts/populate-test-data.ts
```

**Output:**

- First user (`test1@example.com`) is an admin
- All users have email format: `test{N}@example.com`
- Referendum index is printed at the end

### add-bulk-votes.ts

Adds votes to an existing referendum.

**Usage:**

```bash
npx tsx scripts/add-bulk-votes.ts <referendum-index> [num-votes]
```

**Example:**

```bash
# Add 50 votes to referendum #1
npx tsx scripts/add-bulk-votes.ts 1 50
```

Creates new users (`bulk-voter-{N}`) if needed.

### add-bulk-comments.ts

Adds comments to an existing referendum.

**Usage:**

```bash
npx tsx scripts/add-bulk-comments.ts <referendum-index> [num-comments]
```

**Example:**

```bash
# Add 100 comments to referendum #1
npx tsx scripts/add-bulk-comments.ts 1 100
```

Creates new users (`bulk-commenter-{N}`) if needed.

## Testing Scenarios

### Test Pagination (20+ items)

```bash
# Create initial data
npx tsx scripts/populate-test-data.ts

# Add more comments to test "Load more" button
npx tsx scripts/add-bulk-comments.ts 1 30
```

### Test Vote Aggregation

```bash
# Create referendum with 25 votes
npx tsx scripts/populate-test-data.ts

# Add 50 more votes to see aggregation in action
npx tsx scripts/add-bulk-votes.ts 1 50
```

### Test Admin Features

The first user created by `populate-test-data.ts` is an admin:

- Email: `test1@example.com`
- Use Firebase Emulator UI to set password or generate sign-in link
- Admin can: cancel referenda, lock discussions, finalize expired referenda

### Test Real-time Updates

1. Open the referendum in two browser windows
2. In one window, cast a vote
3. Watch the other window update in real-time

### Test Discussion Lock

1. Login as admin (test1@example.com)
2. Click "Lock Discussion" button
3. Verify comment input is disabled
4. Refresh the page - lock state should persist
5. Logout and login as different user - lock should still be enforced

## Notes

- All scripts connect to the emulator at `127.0.0.1:8080` (Firestore) and `127.0.0.1:9099` (Auth)
- Data is isolated to the `demo-test-data` project
- Scripts are idempotent - running them multiple times won't create duplicate users
- Small delays are added between operations to avoid emulator transaction lock timeouts
- To clear all test data and start fresh:
  ```bash
  # Clear Firestore
  curl -X DELETE "http://127.0.0.1:8080/emulator/v1/projects/demo-test-data/databases/(default)/documents"
  # Clear Auth
  curl -X DELETE "http://127.0.0.1:9099/emulator/v1/projects/demo-test-data/accounts"
  ```
