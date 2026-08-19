import { HashRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Hub from './pages/Hub';
import Display from './pages/Display';
import GameMaster from './pages/GameMaster';
import Team from './pages/Team';
import Admin from './pages/Admin';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Hub />} />
          <Route path="display" element={<Display />} />
          <Route path="gamemaster" element={<GameMaster />} />
          <Route path="team" element={<Team />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
