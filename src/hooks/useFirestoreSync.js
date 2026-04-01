import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { loadUserData, saveUserData } from '../firebase/firestoreService';

const DEBOUNCE_DELAY = 5000;

export const useFirestoreSync = (data, setData) => {
  const { user } = useAuth();
  const timeoutRef = useRef(null);
  const lastSavedData = useRef(null);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    if (!user || isLoadingRef.current) return;

    const loadData = async () => {
      isLoadingRef.current = true;
      try {
        const cloudData = await loadUserData(user.uid);
        if (cloudData) {
          const { lastUpdated, ...actualData } = cloudData;
          setData(actualData);
          lastSavedData.current = JSON.stringify(actualData);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        isLoadingRef.current = false;
      }
    };

    loadData();
  }, [user]);

  const debouncedSave = useCallback(() => {
    if (!user) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      const currentData = JSON.stringify(data);
      if (currentData === lastSavedData.current) return;

      try {
        await saveUserData(user.uid, data);
        lastSavedData.current = currentData;
      } catch (error) {
        console.error('Failed to save data:', error);
      }
    }, DEBOUNCE_DELAY);
  }, [user, data]);

  useEffect(() => {
    if (user && !isLoadingRef.current) {
      debouncedSave();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, user, debouncedSave]);
};
