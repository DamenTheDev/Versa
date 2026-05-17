# Versa

Versa is an open source shopping app that learns user taste through pairwise choices and Elo ranking.

## Project docs

- Architecture/design: [`DESIGN.md`](./DESIGN.md)

## Firebase implementation (minimal)

This repository includes a minimal Firebase-first backend implementation for the design:

- Cloud Functions entrypoint: [`functions/index.js`](./functions/index.js)
- Firebase project config: [`firebase.json`](./firebase.json)
- Firestore rules: [`firestore.rules`](./firestore.rules)
- Firestore indexes: [`firestore.indexes.json`](./firestore.indexes.json)

## Getting started

1. Install dependencies for Cloud Functions:
   ```bash
   cd /home/runner/work/Versa/Versa/functions
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
