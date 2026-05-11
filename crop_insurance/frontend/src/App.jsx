import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import NewClaim from './pages/NewClaim';
import ClaimStatus from './pages/ClaimStatus';
import AdminDashboard from './pages/AdminDashboard';
import ResearcherDashboard from './pages/ResearcherDashboard';
import FarmerPolicyPage from './pages/FarmerPolicyPage';
import FAQ from './pages/FAQ';
import ProtectedRoute from './components/ProtectedRoute';
import { useLocation } from 'react-router-dom';
import { LanguageProvider, useTranslation } from './i18n/LanguageContext';

import './index.css';



const Header = () => {
  const { t, language, setLanguage } = useTranslation();
  
  return (
    <header className="glass sticky top-0 z-50 p-4 shadow-sm border-b border-white/50">
      <div className="container mx-auto flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gradient flex items-center gap-2">
          <span className="text-emerald-500">🌿</span> AgriShield AI
        </h1>
        
        <div className="flex items-center gap-4">
          <nav className="flex flex-wrap gap-1 sm:gap-2">
            <Link to="/" className="px-3 py-2 rounded-lg font-medium text-emerald-800 hover:bg-emerald-100/50 hover:text-emerald-600 transition-colors">{t('nav.home')}</Link>
            <Link to="/farmer-policy" className="px-3 py-2 rounded-lg font-medium text-emerald-800 hover:bg-emerald-100/50 hover:text-emerald-600 transition-colors">{t('nav.farmer_policy')}</Link>
            <Link to="/claim" className="px-3 py-2 rounded-lg font-medium text-emerald-800 hover:bg-emerald-100/50 hover:text-emerald-600 transition-colors">{t('nav.new_claim')}</Link>
            <Link to="/status" className="px-3 py-2 rounded-lg font-medium text-emerald-800 hover:bg-emerald-100/50 hover:text-emerald-600 transition-colors">{t('nav.check_status')}</Link>
            <Link to="/admin" className="px-3 py-2 rounded-lg font-medium text-emerald-800 hover:bg-emerald-100/50 hover:text-emerald-600 transition-colors">{t('nav.admin_portal')}</Link>
            <Link to="/research" className="px-3 py-2 rounded-lg font-medium text-emerald-800 hover:bg-emerald-100/50 hover:text-emerald-600 transition-colors">{t('nav.researcher')}</Link>
            <Link to="/faq" className="px-3 py-2 rounded-lg font-medium text-emerald-800 hover:bg-emerald-100/50 hover:text-emerald-600 transition-colors">{t('nav.faq')}</Link>
          </nav>

          <div className="flex items-center gap-2 bg-emerald-100/50 p-1 rounded-xl border border-emerald-200">
            <button 
              onClick={() => setLanguage('en')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${language === 'en' ? 'bg-emerald-600 text-white shadow-md' : 'text-emerald-800 hover:bg-emerald-200'}`}
            >
              EN
            </button>
            <button 
              onClick={() => setLanguage('ta')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${language === 'ta' ? 'bg-emerald-600 text-white shadow-md' : 'text-emerald-800 hover:bg-emerald-200'}`}
            >
              தமிழ்
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer className="glass border-t border-emerald-100 p-6 text-center mt-auto">
        <p className="text-emerald-800 font-medium">{t('common.footer')}</p>
    </footer>
  );
};

function App() {
  return (
    <LanguageProvider>
      <Router>
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex flex-col text-gray-800">
          <Header />

          <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/farmer-policy" element={<FarmerPolicyPage />} />
              <Route path="/claim" element={<NewClaim />} />
              <Route path="/status" element={<ClaimStatus />} />
              <Route path="/admin" element={
                <ProtectedRoute allowedRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/research" element={
                <ProtectedRoute allowedRole="researcher">
                  <ResearcherDashboard />
                </ProtectedRoute>
              } />
              <Route path="/faq" element={<FAQ />} />
            </Routes>
          </main>

          <Footer />
          

        </div>
      </Router>
    </LanguageProvider>
  );
}

export default App;
