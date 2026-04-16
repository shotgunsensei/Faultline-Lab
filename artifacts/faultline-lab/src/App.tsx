import { useAppStore } from '@/stores/useAppStore';
import BootScreen from '@/components/BootScreen';
import IncidentBoard from '@/components/IncidentBoard';
import InvestigationWorkspace from '@/components/InvestigationWorkspace';
import DebriefScreen from '@/components/DebriefScreen';
import ProfileScreen from '@/components/ProfileScreen';
import SettingsScreen from '@/components/SettingsScreen';

function App() {
  const view = useAppStore(s => s.view);

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
      default:
        return <BootScreen />;
    }
  };

  return (
    <div className="dark">
      {renderView()}
    </div>
  );
}

export default App;
