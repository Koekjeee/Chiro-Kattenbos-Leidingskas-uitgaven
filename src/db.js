// db.js
import { db } from "./config.js";

export async function fetchUitgaven() {
  const snap = await db.ref("uitgaven").once("value");
  return snap.val() || {};
}

export function addUitgave(id, data) {
  return db.ref(`uitgaven/${id}`).set(data);
}

export function deleteUitgave(id) {
  return db.ref(`uitgaven/${id}`).remove();
}

export function updateUitgave(id, changes) {
  return db.ref(`uitgaven/${id}`).update(changes);
}
