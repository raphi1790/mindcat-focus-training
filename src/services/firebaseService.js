/**
 * @deprecated Diese Datei ist Alt-Code aus Phase 0 und **nicht mehr der Weg
 * für neue Daten** (CLAUDE.md: "Die alte flache testResults-Collection ist
 * deprecated"). Sie schreibt/liest die flache `testResults`-Collection, die
 * seit Phase 0 auch durch firestore.rules gesperrt ist (jeder Zugriff via
 * `allow read, write: if false` im Catch-all außerhalb von users/{uid}/**).
 *
 * Neue Daten laufen ausschließlich über die typisierten, zod-validierten
 * Repositories in `src/data/firestore/` unter `users/{uid}/children/{childId}/...`
 * (s. childrenRepo, assessmentsRepo, trainingSessionsRepo, progressRepo).
 *
 * Diese Datei bleibt vorerst nur als Referenz/Migrationsnotiz bestehen und
 * wird von keiner aktiven Komponente mehr importiert. Nicht für neue
 * Features verwenden — bei Gelegenheit ganz entfernen.
 */
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";

/** @deprecated s. Datei-Kommentar — schreibt in die gesperrte testResults-Collection. */
export const saveSessionData = async (sessionData) => {
  try {
    const docRef = await addDoc(collection(db, "testResults"), {
      ...sessionData,
      timestamp: new Date().toISOString()
    });
    console.log("Document written with ID: ", docRef.id);
    return true;
  } catch (e) {
    console.error("Error adding document: ", e);
    return false;
  }
};

/** @deprecated s. Datei-Kommentar — liest aus der gesperrten testResults-Collection. */
export const getTestResults = async (supervisorId) => {
  try {
    const q = query(
      collection(db, "testResults"),
      where("supervisorId", "==", supervisorId)
      // Note: Ordering requires a composite index in Firestore if combined with an equality filter on a different field, or we can just sort client-side.
    );
    const querySnapshot = await getDocs(q);
    const results = [];
    querySnapshot.forEach((doc) => {
      results.push({ id: doc.id, ...doc.data() });
    });
    // Client-side sort descending by timestamp
    return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (e) {
    console.error("Error getting documents: ", e);
    return [];
  }
};

/**
 * @deprecated s. Datei-Kommentar. Ersetzt durch
 * `src/data/firestore/progressRepo.ts` (getChildProgress), das echte
 * Baseline/Post-Semantik (Exclusion-Regel) statt reiner sessionDay-Zählung
 * aus der gesperrten testResults-Collection liefert.
 */
export const getChildProgress = async (supervisorId, childId) => {
  try {
    const q = query(
      collection(db, "testResults"),
      where("supervisorId", "==", supervisorId),
      where("childId", "==", childId)
    );
    const querySnapshot = await getDocs(q);
    const results = [];
    querySnapshot.forEach((doc) => {
      results.push(doc.data());
    });
    
    // Find the highest sessionDay completed
    let maxSessionDay = 0;
    results.forEach(r => {
      if (r.sessionDay && r.sessionDay > maxSessionDay) {
        maxSessionDay = r.sessionDay;
      }
    });
    
    // Determine next session day (cap at 5 for now)
    let nextSessionDay = maxSessionDay + 1;
    if (nextSessionDay > 5) nextSessionDay = 5;
    
    return {
      completedDays: maxSessionDay,
      nextSessionDay: nextSessionDay,
      history: results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    };
  } catch (e) {
    console.error("Error getting child progress: ", e);
    return { completedDays: 0, nextSessionDay: 1, history: [] };
  }
};
