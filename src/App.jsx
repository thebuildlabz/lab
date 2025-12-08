import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import IntakePage from './pages/Intake';
import StatusPage from './pages/Status';
import DemosPage from './pages/Demos';
import HomePage from './pages/Home';
import AdminPage from './pages/Admin';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="nav">
          <Link to="/" className="logo">Build Lab</Link>
          <div className="nav-links">
            <Link to="/intake">Start Building</Link>
            <Link to="/demos">Demos</Link>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/intake" element={<IntakePage />} />
          <Route path="/status/:projectId" element={<StatusPage />} />
          <Route path="/demos" element={<DemosPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
