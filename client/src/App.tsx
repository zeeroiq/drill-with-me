import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { ProblemListPage } from './pages/ProblemListPage';
import { ProblemWorkspacePage } from './pages/ProblemWorkspacePage';
import { CustomProblemWorkspacePage } from './pages/CustomProblemWorkspacePage';
import { AdminPortal } from './pages/AdminPortal';

// Component to handle silent page tracking across route changes
const PageTracker: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    // Send a silent background ping to record visited path if endpoint exists
    fetch(`/api/track?path=${encodeURIComponent(location.pathname)}`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {
      // Silently ignore if track endpoint is not active; standard /api requests will track anyway
    });
  }, [location.pathname]);

  return null;
};

// Layout with public Navbar
const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f19] text-slate-100">
      <Navbar />
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <PageTracker />
      <Routes>
        {/* Public Routes with public Navbar */}
        <Route
          path="/"
          element={
            <PublicLayout>
              <ProblemListPage />
            </PublicLayout>
          }
        />
        <Route
          path="/problems/:slug"
          element={
            <PublicLayout>
              <ProblemWorkspacePage />
            </PublicLayout>
          }
        />
        <Route
          path="/custom"
          element={
            <PublicLayout>
              <CustomProblemWorkspacePage />
            </PublicLayout>
          }
        />
        <Route
          path="/custom/:id"
          element={
            <PublicLayout>
              <CustomProblemWorkspacePage />
            </PublicLayout>
          }
        />

        {/* Hidden Admin Portal: NO public navbar, fully self-contained */}
        <Route path="/itsme" element={<AdminPortal />} />

        {/* Catch-all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
