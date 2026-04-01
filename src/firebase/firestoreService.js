import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './config';

export const loadUserData = async (userId) => {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error('Error loading data from Firestore:', error);
    throw error;
  }
};

export const saveUserData = async (userId, data) => {
  try {
    const docRef = doc(db, 'users', userId);
    await setDoc(docRef, {
      ...data,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error saving data to Firestore:', error);
    throw error;
  }
};
