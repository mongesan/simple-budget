import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { loadUserData, saveUserData } from '../firebase/firestoreService';

const DEBOUNCE_DELAY = 5000;

export const useFirestoreSync = (data, setData) => {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState(null); // 保存状態を管理
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
        //成功時の時間を保持
        const now = new Date();
        const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
        setSyncStatus({ type: 'success', msg: `保存成功(${timeStr})` });
      } catch (error) {
        console.error('Failed to save data:', error);
        // 失敗時のエラーコード(あれば)を表示
        const code = error.code ? error.code.toUpperCase().slice(0,5) : 'ERR';
        setSyncStatus({ type: 'error', msg: 'エラー(${code})'});
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
  return syncStatus;
};
