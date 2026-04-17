import { useEffect } from 'react';
import { ClerkProvider, useUser } from '@clerk/react';
import { useAppStore } from '@/stores/useAppStore';
import BootScreen from '@/components/BootScreen';
import IncidentBoard from '@/components/IncidentBoard';
import InvestigationWorkspace from '@/components/InvestigationWorkspace';
import DebriefScreen from '@/components/DebriefScreen';
import ProfileScreen from '@/components/ProfileScreen';
import SettingsScreen from '@/components/SettingsScreen';
import StoreScreen from '@/components/StoreScreen';
import AuthScreen from '@/components/AuthScreen';
import AdminPanel from '@/components/AdminPanel';
import DailyChallengeScreen from '@/components/DailyChallengeScreen';
import SandboxScreen from '@/components/SandboxScreen';
import { CloudSyncProvider } from '@/components/CloudSyncProvider';
import { UpgradePromptProvider } from '@/components/UpgradePrompt';
import { resetEntitlements } from '@/lib/entitlements';
import { logCatalogValidation } from '@/data/caseCatalog';
import { runAuthoringSelfTest } from '@/data/cases/authoring';
import { Toaster } from 'sonner';

logCatalogValidation();
runAuthoringSelfTest();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL || undefined;

function AppContent() {
  const view = useAppStore(s => s.view);
  const { user, isLoaded } = useUser();
  const setAuthUser = useAppStore(s => s.setAuthUser);

  useEffect(() => {
    if (isLoaded) {
      setAuthUser(user ? {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress || null,
        name: user.fullName || user.firstName || null,
        avatarUrl: user.imageUrl || null,
      } : null);
    }
  }, [user, isLoaded, setAuthUser]);

  const renderView = () => {
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
      case 'settings':
        return <SettingsScreen />;
      case 'store':
        return <StoreScreen />;
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
  };

  return (
    <UpgradePromptProvider>
      <CloudSyncProvider>
        <div className="dark">
          {renderView()}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#18181b',
                border: '1px solid #27272a',
                color: '#e4e4e7',
              },
            }}
          />
        </div>
      </CloudSyncProvider>
    </UpgradePromptProvider>
  );
}

function AppContentWithoutClerk() {
  const view = useAppStore(s => s.view);

  useEffect(() => {
    resetEntitlements();
  }, []);

  const renderView = () => {
    switch (view) {
      case 'boot': return <BootScreen />;
      case 'incident-board': return <IncidentBoard />;
      case 'investigation': return <InvestigationWorkspace />;
      case 'debrief': return <DebriefScreen />;
      case 'profile': return <ProfileScreen />;
      case 'settings': return <SettingsScreen />;
      case 'store': return <StoreScreen />;
      case 'admin': return <AdminPanel />;
      case 'auth': return <IncidentBoard />;
      case 'daily': return <DailyChallengeScreen />;
      case 'sandbox': return <SandboxScreen />;
      default: return <BootScreen />;
    }
  };

  return (
    <UpgradePromptProvider>
      {renderView()}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#18181b',
            border: '1px solid #27272a',
            color: '#e4e4e7',
          },
        }}
      />
    </UpgradePromptProvider>
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
