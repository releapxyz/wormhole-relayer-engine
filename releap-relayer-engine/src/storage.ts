import admin from "firebase-admin";

import { DocumentData } from "firebase-admin/firestore";

const serviceAccount = require("./servicekey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://fir-api-9a206.firebaseio.com",
});

const db = admin.firestore();

db.settings({ ignoreUndefinedProperties: true });

export async function storeDoc<T extends DocumentData>(
  collection: string,
  docId: string,
  data: T
) {
  const ref = db.collection(collection).doc(docId);
  return await ref.set(data);
}
