import { lazy, Suspense, useEffect } from 'react';
import { ClerkProvider, useUser } from '@clerk/react';
import { useAppStore } from '@/stores/useAppStore';
import BootScreen from '@/components/BootScreen';
import { resetEntitlements, hasEntitlement } from '@/lib/entitlements';
import { useRouteSeo } from '@/lib/seo';
import { logCatalogValidation } from '@/data/caseCatalog';
import { runAuthoringSelfTest } from '@/data/cases/authoring';
import { fetchMe } from '@/lib/api';
import { consumeSsoLandingParams } from '@/lib/ssoLanding';

const IncidentBoard = lazy(() => import('@/components/IncidentBoard'));
const InvestigationWorkspace = lazy(() => import('@/components/InvestigationWorkspace'));
const DebriefScreen = lazy(() => import('@/components/DebriefScreen'));
const ProfileScreen = lazy(() => import('@/components/ProfileScreen'));
const AccountScreen = lazy(() => import('@/components/AccountScreen'));
const SettingsScreen = lazy(() => import('@/components/SettingsScreen'));
const StoreScreen = lazy(() => import('@/components/StoreScreen'));
const PricingScreen = lazy(() => import('@/components/PricingScreen'));
const AuthScreen = lazy(() => import('@/components/AuthScreen'));
const AdminPanel = lazy(() => import('@/components/AdminPanel'));
const DailyChallengeScreen = lazy(() => import('@/components/DailyChallengeScreen'));
const SandboxScreen = lazy(() => import('@/components/SandboxScreen'));
const CloudSyncProvider = lazy(() =>
  import('@/components/CloudSyncProvider').then(m => ({ default: m.CloudSyncProvider })),
);
const UpgradePromptProvider = lazy(() =>
  import('@/components/UpgradePrompt').then(m => ({ default: m.UpgradePromptProvider })),
);
const InstallAppButton = lazy(() => import('@/components/InstallAppButton'));
const Toaster = lazy(() => import('sonner').then(m => ({ default: m.Toaster })));
const OnboardingTour = lazy(() => import('@/components/OnboardingTour'));

logCatalogValidation();
runAuthoringSelfTest();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL || undefined;

function ScreenFallback() {
  return (
    <div className="fixed inset-0 bg-[#0a0e14] flex items-center justify-center">
      <div className="font-mono text-cyan-400 text-sm tracking-wide animate-pulse">
        loading module...
      </div>
    </div>
  );
}

function renderView(view: string) {
  switch (view) {
    case 'boot':
      return <BootScreen />;
    case 'incident-board':
      return <IncidentBoard />;
    case 'investigation':
      return <InvestigationWorkspace />;
    case 'debrief':
      return <DebriefScreen />;
    case 'profile':
      return <ProfileScreen />;
    case 'account':
      return <AccountScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'store':
      return <StoreScreen />;
    case 'pricing':
      return <PricingScreen />;
    case 'admin':
      return <AdminPanel />;
    case 'auth':
      return <AuthScreen />;
    case 'daily':
      return <DailyChallengeScreen />;
    case 'sandbox':
      return <SandboxScreen />;
    default:
      return <BootScreen />;
  }
}

const TOASTER_STYLE = {
  background: '#18181b',
  border: '1px solid #27272a',
  color: '#e4e4e7',
} as const;

function PricingIntroRedirect() {
  const view = useAppStore(s => s.view);
  const isSignedIn = useAppStore(s => s.isSignedIn);
  const authLoaded = useAppStore(s => s.authLoaded);
  const cloudSyncReady = useAppStore(s => s.cloudSyncReady);
  const settings = useAppStore(s => s.settings);
  const setView = useAppStore(s => s.setView);
  const updateSettings = useAppStore(s => s.updateSettings);

  useEffect(() => {
    if (!authLoaded || !isSignedIn || !cloudSyncReady) return;
    if (settings.pricingIntroSeenAt) return;
    // Only intercept the first landing on the incident board (or the
    // transient 'auth' view that renders the board after sign-in).
    if (view !== 'incident-board' && view !== 'auth') return;
    // Existing Pro/Bundle owners already chose a plan; don't nag them.
    if (hasEntitlement('pro-subscription') || hasEntitlement('bundle-master-investigator')) {
      updateSettings({ pricingIntroSeenAt: Date.now() });
      return;
    }
    updateSettings({ pricingIntroSeenAt: Date.now() });
    setView('pricing');
  }, [
    authLoaded,
    isSignedIn,
    cloudSyncReady,
    settings.pricingIntroSeenAt,
    view,
    setView,
    updateSettings,
  ]);

  return null;
}

function GlobalOnboardingTour() {
  const view = useAppStore(s => s.view);
  const settings = useAppStore(s => s.settings);
  const isSignedIn = useAppStore(s => s.isSignedIn);
  const authLoaded = useAppStore(s => s.authLoaded);
  const cloudSyncReady = useAppStore(s => s.cloudSyncReady);
  const updateSettings = useAppStore(s => s.updateSettings);
  const eligibleView = view !== 'boot' && view !== 'auth';
  const settingsReady = authLoaded && (!isSignedIn || cloudSyncReady);
  const open =
    eligibleView && settingsReady && !settings.onboardingTourCompletedAt;
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <OnboardingTour
        open={open}
        onClose={() => updateSettings({ onboardingTourCompletedAt: Date.now() })}
      />
    </Suspense>
  );
}

function AppContent() {
  const view = useAppStore(s => s.view);
  const { user, isLoaded } = useUser();
  const setAuthUser = useAppStore(s => s.setAuthUser);
  const setAuthLoaded = useAppStore(s => s.setAuthLoaded);
  useRouteSeo(view);

  useEffect(() => {
    if (!isLoaded) return;
    if (user) {
      setAuthUser({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress || null,
        name: user.fullName || user.firstName || null,
        avatarUrl: user.imageUrl || null,
      });
      setAuthLoaded(true);
      return;
    }
    // No Clerk session: check whether the user arrived via OperatorOS SSO
    // (signed cookie set by the api-server's /sso endpoint). If so, hydrate
    // signed-in state from /api/me so cloud sync, entitlements, and admin
    // routes work without Clerk credentials.
    let cancelled = false;
    consumeSsoLandingParams();
    fetchMe()
      .then((me) => {
        if (cancelled) return;
        if (me) {
          setAuthUser({
            id: me.user.id,
            email: me.user.email,
            name: me.user.displayName,
            avatarUrl: me.user.avatarUrl,
          });
        } else {
          setAuthUser(null);
        }
        setAuthLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setAuthUser(null);
        setAuthLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, isLoaded, setAuthUser, setAuthLoaded]);

  return (
    <Suspense fallback={<ScreenFallback />}>
      <UpgradePromptProvider>
        <CloudSyncProvider>
          <div className="dark">
            <Suspense fallback={<ScreenFallback />}>{renderView(view)}</Suspense>
            <InstallAppButton />
            <GlobalOnboardingTour />
            <PricingIntroRedirect />
            <Toaster position="bottom-right" toastOptions={{ style: TOASTER_STYLE }} />
          </div>
        </CloudSyncProvider>
      </UpgradePromptProvider>
    </Suspense>
  );
}

function AppContentWithoutClerk() {
  const view = useAppStore(s => s.view);
  const setAuthLoaded = useAppStore(s => s.setAuthLoaded);
  const setAuthUser = useAppStore(s => s.setAuthUser);
  const isSignedIn = useAppStore(s => s.isSignedIn);
  useRouteSeo(view);

  useEffect(() => {
    let cancelled = false;
    consumeSsoLandingParams();
    fetchMe()
      .then((me) => {
        if (cancelled) return;
        if (me) {
          setAuthUser({
            id: me.user.id,
            email: me.user.email,
            name: me.user.displayName,
            avatarUrl: me.user.avatarUrl,
          });
        } else {
          resetEntitlements();
          setAuthUser(null);
        }
        setAuthLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        resetEntitlements();
        setAuthLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [setAuthLoaded, setAuthUser]);

  return (
    <Suspense fallback={<ScreenFallback />}>
      <UpgradePromptProvider>
        {isSignedIn ? (
          <CloudSyncProvider>
            <Suspense fallback={<ScreenFallback />}>
              {view === 'auth' ? <IncidentBoard /> : renderView(view)}
            </Suspense>
            <InstallAppButton />
            <GlobalOnboardingTour />
            <PricingIntroRedirect />
            <Toaster position="bottom-right" toastOptions={{ style: TOASTER_STYLE }} />
          </CloudSyncProvider>
        ) : (
          <>
            <Suspense fallback={<ScreenFallback />}>
              {view === 'auth' ? <IncidentBoard /> : renderView(view)}
            </Suspense>
            <InstallAppButton />
            <GlobalOnboardingTour />
            <Toaster position="bottom-right" toastOptions={{ style: TOASTER_STYLE }} />
          </>
        )}
      </UpgradePromptProvider>
    </Suspense>
  );
}

function App() {
  if (!clerkPubKey) {
    return (
      <div className="dark">
        <AppContentWithoutClerk />
      </div>
    );
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
    >
      <AppContent />
    </ClerkProvider>
  );
}

export default App;
