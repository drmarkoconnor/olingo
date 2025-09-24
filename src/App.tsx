import { NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/store/useAuth';
import { useSync } from '@/store/useSync';
import Study from '@/pages/Study';
import Categories from '@/pages/Categories';
import Games from '@/pages/Games';
import Stats from '@/pages/Stats';
import Settings from '@/pages/Settings';
import ImportData from '@/pages/ImportData';

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
          <h1>Olingo</h1>
          <TopRightStatus />
        </div>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Study />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/games" element={<Games />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/import" element={<ImportData />} />
        </Routes>
      </main>
      <nav className="tabbar">
        <NavLink to="/" end>Study</NavLink>
        <NavLink to="/categories">Categories</NavLink>
        <NavLink to="/games">Games</NavLink>
        <NavLink to="/stats">Stats</NavLink>
        <NavLink to="/settings">Settings</NavLink>
        <NavLink to="/import">Import</NavLink>
      </nav>
    </div>
  );
}

function TopRightStatus(){
  const { email } = useAuth();
  const { syncing, syncAll } = useSync();
  return (
    <div className="row" style={{gap:8}}>
      <span style={{fontSize:12,color:'var(--muted)'}}>{email ? email : 'offline'}</span>
      <button className="btn btn-muted" style={{flex:'none',padding:'6px 10px'}} disabled={syncing} onClick={syncAll}>{syncing ? 'Sync…' : 'Sync'}</button>
    </div>
  );
}
