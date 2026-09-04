import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Sidebar from './components/Sidebar';
import ToastContainer from './components/ToastContainer';
import Dashboard from './pages/Dashboard';
import Overview from './pages/Overview';
import ModelComparison from './pages/ModelComparison';
import About from './pages/About';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        {/* Subtle cybersecurity background */}
        <div className="bg-canvas" aria-hidden="true" />

        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/overview" element={<Overview />} />
              <Route path="/model-comparison" element={<ModelComparison />} />
              <Route path="/about" element={<About />} />
            </Routes>
            <div className="footer">
              © 2024 Network Intrusion Detection System — Deep Learning for Cybersecurity
            </div>
          </main>
          <ToastContainer />
        </div>
      </BrowserRouter>
    </AppProvider>
  );
}
