import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { Hero } from './components/sections/Hero';
import { Features } from './components/sections/Features';
import { Footer } from './components/layout/Footer';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { DashboardLayout } from './components/layout/DashboardLayout';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SwapPage = lazy(() => import('./pages/SwapPage'));
const StakePage = lazy(() => import('./pages/StakePage'));
const VaultPage = lazy(() => import('./pages/VaultPage'));

const LoadingFallback = () => (
  <div className="min-h-screen bg-[#0c0f1e] flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin" />
  </div>
);

function LandingPage() {
  return (
    <div className="min-h-screen text-[var(--color-text)] font-body bg-[var(--color-bg)] selection:bg-[var(--color-primary)]/30 selection:text-white">
      <Navbar />
      <main>
        <Hero />
        <Features />
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          
          {/* Dashboard Layout Route */}
          <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/swap" element={<SwapPage />} />
            <Route path="/stake" element={<StakePage />} />
            <Route path="/vault" element={<VaultPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
