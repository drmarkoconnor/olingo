import { NavLink, Route, Routes } from 'react-router-dom';
import Study from './pages/Study';
import Categories from './pages/Categories';
import Games from './pages/Games';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
import ImportData from './pages/ImportData';

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <h1>Olingo</h1>
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
