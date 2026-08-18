import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, PlusCircle, Settings as SettingsIcon, Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';
import { seedDatabase } from './seed';
import { materializeFixedEntries } from './fixedEntries';
import { triggerAutoSync, onSyncStatusChange, type SyncStatus, syncWithDrive, setGlobalSyncStatus, initGoogleDriveApi } from './GoogleSync';
import Dashboard from './Dashboard';
import NewEntry from './NewEntry';
import Settings from './Settings';
import HistoryPage from './HistoryPage';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

function Navigation() {
  const location = useLocation();
  
  return (
    <nav className="bottom-nav">
      <Link to="/new" className={`nav-item ${location.pathname === '/new' ? 'active' : ''}`}>
        <PlusCircle />
        <span>Lançar</span>
      </Link>
      <Link to="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
        <Home />
        <span>Início</span>
      </Link>
      <Link to="/settings" className={`nav-item ${location.pathname === '/settings' ? 'active' : ''}`}>
        <SettingsIcon />
        <span>Ajustes</span>
      </Link>
    </nav>
  );
}

function CloudSyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>('offline');

  useEffect(() => {
    const unsubscribe = onSyncStatusChange(setStatus);
    return () => { unsubscribe(); };
  }, []);

  const login = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/drive.appdata',
    onSuccess: async (tokenResponse) => {
      const token = tokenResponse.access_token;
      localStorage.setItem('gdrive_token', token);
      setGlobalSyncStatus('syncing');
      try {
        await syncWithDrive(token);
        setGlobalSyncStatus('synced');
      } catch (err) {
        console.error('Manual sync login error:', err);
        setGlobalSyncStatus('error');
      }
    },
    onError: () => {
      setGlobalSyncStatus('error');
    }
  });

  const handleClick = () => {
    if (status === 'offline' || status === 'error') {
      login();
    } else if (status === 'synced' || status === 'idle') {
      triggerAutoSync();
    }
  };

  let Icon = Cloud;
  let colorClass = 'text-green';
  let title = 'Sincronizado';

  if (status === 'offline') {
    Icon = CloudOff;
    colorClass = 'text-secondary opacity-50';
    title = 'Modo Offline. Clique para reconectar e salvar.';
  } else if (status === 'syncing') {
    Icon = RefreshCw;
    colorClass = 'text-primary animate-spin';
    title = 'Sincronizando...';
  } else if (status === 'error') {
    Icon = AlertCircle;
    colorClass = 'text-red';
    title = 'Erro de sincronização. Clique para tentar novamente.';
  }

  return (
    <div 
      className="fixed top-4 right-4 z-50 p-2 rounded-full bg-[var(--surface-color)] shadow-md border border-[var(--border-color)] cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
      onClick={handleClick}
      title={title}
    >
      <Icon size={20} className={colorClass} />
    </div>
  );
}

function App() {
  useEffect(() => {
    initGoogleDriveApi().then(() => {
      console.log('GAPI inicializado');
      seedDatabase().then(() => {
        materializeFixedEntries().then(count => {
          if (count > 0) triggerAutoSync();
        }).catch(e => console.error('Erro ao materializar fixos:', e));
      });
    }).catch(e => console.error(e));
    
    const savedTheme = localStorage.getItem('finance-theme') || 'purple';
    if (savedTheme !== 'purple') {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'MISSING_CLIENT_ID';

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <CloudSyncIndicator />
      <HashRouter>
        <div className="container">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new" element={<NewEntry />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </div>
        <Navigation />
      </HashRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
