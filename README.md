# Versa

An open source shopping app that learns your tastes.

## Engineering Design Document: Versa (Firebase Edition)

### 1. System Architecture Overview

Versa uses a dual-model ML pipeline (Preference Model + Elo Model) on top of serverless Firebase infrastructure.

#### Infrastructure Stack

- **Frontend**: React (Web/PWA) on Firebase Hosting.
- **Authentication**: Firebase Auth (Anonymous + OAuth).
- **Primary Database**: Cloud Firestore.
- **Vector Database**: Pinecone or Firestore Vector Search (Vertex AI extension).
- **Backend API & ML Orchestration**: Firebase Cloud Functions (Python or Node.js).
- **Data Source**: Google Shopping API via Cloud Functions.

### 2. Cloud Firestore Schema

Firestore is split into public and private/user data spaces to fit security rule and indexing constraints.

#### `public/data/items` (collection)

Global cache of Google Shopping items shared across users.

- `documentId`: UUID (e.g., `item_123`)
- `source_id`: String (Google API product ID)
- `title`: String
- `price`: Number
- `image_url`: String
- `merchant_name`: String
- `created_at`: Timestamp

#### `users/{userId}/item_elos` (collection)

User-specific "True Elo" for interacted/simulated items.

- `documentId`: matches global `item_id` (e.g., `item_123`)
- `item_id`: String (reference to public item)
- `elo`: Number (default `1200`)
- `matches_played`: Number
- `last_updated`: Timestamp

#### `users/{userId}/match_history` (collection)

Ground-truth duel log used to train the Preference Model.

- `documentId`: auto-generated UUID
- `winner_item_id`: String
- `loser_item_id`: String
- `search_context`: String (e.g., `"couches"`)
- `created_at`: Timestamp

### 3. Serverless Backend: Firebase Cloud Functions

Cloud Functions handle fetch + ML orchestration instead of an always-on gateway.

#### Function 1: `fetchFromGoogleShopping` (HTTPS callable)

Triggered by frontend when searched items are not cached:

1. Call Google Shopping API.
2. Normalize response JSON.
3. Batch write new items into `public/data/items`.
4. Publish event to Cloud Pub/Sub for embedding generation.

#### Function 2: `onDuelResolved` (Firestore trigger)

Triggered when a document is created in `users/{userId}/match_history/{matchId}`:

```js
functions.firestore.document('users/{userId}/match_history/{matchId}').onCreate(...)
```

1. Push interaction to ML training queue for Pairwise Preference Model updates.
2. Optionally trigger near-real-time model updates (online learning).

#### Function 3: `runNightlySimulations` (Pub/Sub scheduled cron)

Nightly "Tournament Simulator":

1. Runs nightly.
2. Retrieves candidate item pools (including unseen items) from the vector DB.
3. Uses Preference Model to simulate matches and update Elo outcomes.
4. Batch writes updated Elo values to `users/{userId}/item_elos`.

### 4. Frontend Strategy (React)

- **Real-time listeners**: Subscribe to `users/{userId}/item_elos` via `onSnapshot()` so leaderboard updates immediately on duel writes/nightly simulations.
- **In-memory pairing**: Fetch user Elo subset + public item cache and join locally to generate similar-Elo matchups without complex Firestore queries.
