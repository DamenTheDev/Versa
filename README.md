# Versa

Versa is an open source shopping app that learns user taste through pairwise choices and Elo ranking.

## Project docs

- Architecture/Design: [`DESIGN.md`](DESIGN.md)

## Firebase implementation (minimal)

This repository includes a minimal Firebase-first backend implementation for the design:

- Cloud Functions entrypoint: [`functions/index.js`](functions/index.js)
- Firebase project config: [`firebase.json`](firebase.json)
- Firestore rules: [`firestore.rules`](firestore.rules)
- Firestore indexes: [`firestore.indexes.json`](firestore.indexes.json)

## Runtime configuration

Set these Cloud Functions environment variables before deploy:

- `GOOGLE_SHOPPING_ENDPOINT` (required): base URL for the Google Shopping API query endpoint.
- `EMBEDDING_TOPIC` (optional): Pub/Sub topic for embedding jobs. Defaults to `versa-embedding-jobs`.
- `TRAINING_TOPIC` (optional): Pub/Sub topic for preference-model training jobs. Defaults to `versa-training-jobs`.

`runNightlySimulations` is scheduled for `01:00` in `Etc/UTC`.

## Getting started

1. Install dependencies for Cloud Functions:
   ```bash
   cd functions
   npm install
   ```
2. Run local lint/check as needed:
   ```bash
   node --check index.js
   ```
3. Deploy with Firebase CLI from repository root after project setup:
   ```bash
   firebase deploy
   ```
