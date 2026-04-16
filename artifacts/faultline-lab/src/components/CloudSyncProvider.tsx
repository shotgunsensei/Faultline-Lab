import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { fetchProfile, saveProfileToCloud, fetchEntitlements } from '@/lib/api';
import { setEntitlements } from '@/lib/entitlements';
import { loadCaseStates, saveCaseStates } from '@/lib/persistence';

export function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  const isSignedIn = useAppStore(s => s.isSignedIn);
  const profile = useAppStore(s => s.profile);
  const settings = useAppStore(s => s.settings);
  const syncedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncFromCloud = useCallback(async () => {
    if (syncedRef.current) return;
    try {
      const [profileData, entitlementData] = await Promise.all([
        fetchProfile(),
        fetchEntitlements(),
      ]);

      if (entitlementData) {
        setEntitlements(entitlementData);
      }

      if (profileData?.profile) {
        useAppStore.getState().updateProfile(profileData.profile);
      }
      if (profileData?.settings) {
        useAppStore.getState().updateSettings(profileData.settings);
      }
      if (profileData?.caseStates && typeof profileData.caseStates === 'object') {
        const localStates = loadCaseStates();
        const merged = { ...profileData.caseStates };
        for (const [caseId, localState] of Object.entries(localStates)) {
          const cloudState = merged[caseId] as any;
          const local = localState as any;
          if (!cloudState || (local?.lastActiveAt && (!cloudState.lastActiveAt || local.lastActiveAt > cloudState.lastActiveAt))) {
            merged[caseId] = localState;
          }
        }
        saveCaseStates(merged as Record<string, any>);
      }

      syncedRef.current = true;
    } catch (err) {
      console.warn('Cloud sync failed, using local data:', err);
    }
  }, []);

  const saveToCloud = useCallback(async () => {
    try {
      const currentProfile = useAppStore.getState().profile;
      const currentSettings = useAppStore.getState().settings;
      const caseStates = loadCaseStates();
      await saveProfileToCloud({
        profile: currentProfile,
        settings: currentSettings,
        caseStates,
      });
    } catch (err) {
      console.warn('Cloud save failed:', err);
    }
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      syncFromCloud();
    } else {
      syncedRef.current = false;
      setEntitlements({
        ownedProductIds: ['base-free'],
        activeSubscription: null,
        isProUser: false,
      });
    }
  }, [isSignedIn, syncFromCloud]);

  useEffect(() => {
    if (!isSignedIn || !syncedRef.current) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      saveToCloud();
    }, 2000);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [isSignedIn, profile, settings, saveToCloud]);

  return <>{children}</>;
}
