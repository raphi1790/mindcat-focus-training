import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase/config";

export const saveSessionData = async (sessionData) => {
  try {
    // In a real app we'd await addDoc(...)
    // For MVP with placeholder config, we'll mock the saving.
    console.log("Mock: Saving session data to Firestore:", sessionData);
    
    /* Real implementation would look like this:
    const docRef = await addDoc(collection(db, "sessions"), {
      ...sessionData,
      timestamp: new Date().toISOString()
    });
    console.log("Document written with ID: ", docRef.id);
    */
    
    return true;
  } catch (e) {
    console.error("Error adding document: ", e);
    return false;
  }
};
