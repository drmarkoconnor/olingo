import { NavLink, Route, Routes } from 'react-router-dom'
import {
	BarChart3,
	BookOpen,
	Cloud,
	Map,
	Newspaper,
	RotateCcw,
	Settings as SettingsIcon,
	WifiOff,
} from 'lucide-react'
import { useAuth } from '@/store/useAuth'
import Study from '@/pages/Study'
import Scenes from '@/pages/Scenes'
import Mistakes from '@/pages/Mistakes'
import Stats from '@/pages/Stats'
import Settings from '@/pages/Settings'
import ImportData from '@/pages/ImportData'
import Sources from '@/pages/Sources'
import AuthGate from '@/ui/AuthGate'

export default function App() {
	const { authenticated, ready } = useAuth()

	if (!ready) {
		return (
			<div className="auth-page">
				<section className="auth-card">
					<p className="eyebrow">Opening Olingo</p>
					<h1>Checking your session...</h1>
				</section>
			</div>
		)
	}

	if (!authenticated) return <AuthGate />

	return (
		<div className="app">
			<header className="topbar">
				<div className="brand-row">
					<div>
						<p className="app-kicker">Italian speaking gym</p>
						<h1>Olingo</h1>
					</div>
					<TopRightStatus />
				</div>
			</header>
			<main className="content">
				<Routes>
					<Route path="/" element={<Study />} />
					<Route path="/scenes" element={<Scenes />} />
					<Route path="/mistakes" element={<Mistakes />} />
					<Route path="/sources" element={<Sources />} />
					<Route path="/stats" element={<Stats />} />
					<Route path="/settings" element={<Settings />} />
					<Route path="/import" element={<ImportData />} />
				</Routes>
			</main>
			<nav className="tabbar">
				<NavLink to="/" end>
					<BookOpen size={18} />
					Today
				</NavLink>
				<NavLink to="/scenes">
					<Map size={18} />
					Scenes
				</NavLink>
				<NavLink to="/mistakes">
					<RotateCcw size={18} />
					Mistakes
				</NavLink>
				<NavLink to="/stats">
					<BarChart3 size={18} />
					Stats
				</NavLink>
				<NavLink to="/sources">
					<Newspaper size={18} />
					Sources
				</NavLink>
				<NavLink to="/settings">
					<SettingsIcon size={18} />
					Settings
				</NavLink>
			</nav>
		</div>
	)
}

function TopRightStatus() {
	const { email, localMode, name } = useAuth()
	const statusLabel = localMode ? 'local practice' : email ?? name ?? 'signed in'

	return (
		<div className="top-status">
			<span>
				{localMode ? <WifiOff size={14} /> : <Cloud size={14} />}
				{statusLabel}
			</span>
		</div>
	)
}
