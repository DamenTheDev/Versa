const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {logger} = require("firebase-functions");
const {PubSub} = require("@google-cloud/pubsub");

admin.initializeApp();

const db = admin.firestore();
const pubsub = new PubSub();

const EMBEDDING_TOPIC = process.env.EMBEDDING_TOPIC || "versa-embedding-jobs";
const TRAINING_TOPIC = process.env.TRAINING_TOPIC || "versa-training-jobs";
const GOOGLE_SHOPPING_ENDPOINT = process.env.GOOGLE_SHOPPING_ENDPOINT;
// Safety caps for scheduled simulation fanout in a single invocation.
const MAX_NIGHTLY_SIMULATION_USERS = 100;
const MAX_SIMULATION_ITEMS_PER_USER = 25;
// Elo simulation defaults for a lightweight nightly update.
const DEFAULT_ELO = 1200;
const ELO_DELTA_MIN = -20;
const ELO_DELTA_MAX = 20;

function normalizeShoppingItem(rawItem) {
  if (!rawItem || !rawItem.id || !rawItem.title) {
    return null;
  }

  return {
    source_id: String(rawItem.id),
    title: String(rawItem.title),
    price: Number(rawItem.price || 0),
    image_url: String(rawItem.image_url || ""),
    merchant_name: String(rawItem.merchant_name || ""),
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  };
}

function calculateSimulationEloDelta(randomFn = Math.random) {
  return Math.floor(
      randomFn() * (ELO_DELTA_MAX - ELO_DELTA_MIN + 1),
  ) + ELO_DELTA_MIN;
}

exports.fetchFromGoogleShopping = onCall(async (request) => {
  const query = request.data?.query;
  if (!query || typeof query !== "string") {
    throw new HttpsError("invalid-argument", "query is required");
  }

  if (!GOOGLE_SHOPPING_ENDPOINT) {
    throw new HttpsError(
        "failed-precondition",
        "GOOGLE_SHOPPING_ENDPOINT environment variable is not configured; set it to the Google Shopping API base URL.",
    );
  }

  const response = await fetch(
      `${GOOGLE_SHOPPING_ENDPOINT}?q=${encodeURIComponent(query)}`,
  );
  if (!response.ok) {
    throw new HttpsError(
        "internal",
        `google shopping request failed with status ${response.status}`,
    );
  }

  const payload = await response.json();
  const items = Array.isArray(payload.items) ? payload.items : [];
  const normalized = items.map(normalizeShoppingItem).filter(Boolean);

  if (!normalized.length) {
    return {cachedCount: 0};
  }

  const batch = db.batch();
  const itemIds = [];

  normalized.forEach((item) => {
    const itemId = `item_${item.source_id}`;
    itemIds.push(itemId);
    const itemRef = db.doc(`public/data/items/${itemId}`);
    batch.set(itemRef, item, {merge: true});
  });
  await batch.commit();

  await pubsub.topic(EMBEDDING_TOPIC).publishMessage({
    json: {query, item_ids: itemIds},
  });

  return {cachedCount: itemIds.length, itemIds};
});

exports.onDuelResolved = onDocumentCreated(
    "users/{userId}/match_history/{matchId}",
    async (event) => {
      const doc = event.data?.data();
      if (!doc) {
        return;
      }

      await pubsub.topic(TRAINING_TOPIC).publishMessage({
        json: {
          user_id: event.params.userId,
          match_id: event.params.matchId,
          winner_item_id: doc.winner_item_id,
          loser_item_id: doc.loser_item_id,
          search_context: doc.search_context || "",
          created_at: doc.created_at || null,
        },
      });
    },
);

exports.runNightlySimulations = onSchedule({
  schedule: "every day 01:00",
  timeZone: "Etc/UTC",
}, async () => {
  const usersSnapshot = await db
      .collection("users")
      .limit(MAX_NIGHTLY_SIMULATION_USERS)
      .get();
  if (usersSnapshot.empty) {
    logger.info("No users found for nightly simulation");
    return;
  }

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const itemDocs = await db
        .collection("public/data/items")
        .limit(MAX_SIMULATION_ITEMS_PER_USER)
        .get();
    if (itemDocs.empty) {
      continue;
    }

    const batch = db.batch();
    itemDocs.docs.forEach((itemDoc) => {
      const itemId = itemDoc.id;
      const eloRef = db.doc(`users/${userId}/item_elos/${itemId}`);
      const randomDelta = calculateSimulationEloDelta();
      batch.set(eloRef, {
        item_id: itemId,
        elo: DEFAULT_ELO + randomDelta,
        matches_played: admin.firestore.FieldValue.increment(1),
        last_updated: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
    });
    await batch.commit();
  }
});

exports._normalizeShoppingItem = normalizeShoppingItem;
exports._calculateSimulationEloDelta = calculateSimulationEloDelta;
