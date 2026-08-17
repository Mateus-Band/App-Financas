import { useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, PlusCircle, Settings as SettingsIcon } from 'lucide-react';
import { seedDatabase } from './seed';
import { materializeFixedEntries } from './fixedEntries';
import Dashboard from './Dashboard';
import NewEntry from './NewEntry';
import Settings from './Settings';
import { GoogleOAuthProvider } from '@react-oauth/google';

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

function App() {
  useEffect(() => {
    seedDatabase().then(() => {
      materializeFixedEntries().catch(e => console.error('Erro ao materializar fixos:', e));
    });
  }, []);

  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'MISSING_CLIENT_ID';

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <HashRouter>
        <div className="container">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new" element={<NewEntry />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
        <Navigation />
      </HashRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
