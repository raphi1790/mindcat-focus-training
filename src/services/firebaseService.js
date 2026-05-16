import { collection, addDoc, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "./firebase";

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
