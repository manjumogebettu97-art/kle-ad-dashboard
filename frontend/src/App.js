import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PlatformProvider, usePlatform } from './context/PlatformContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar    from './components/Navbar';
import Login     from './pages/Login';
import Dashboard from './pages/Dashboard';
import Locations  from './pages/Locations';
import Placements from './pages/Placements';
import Ads        from './pages/Ads';
import Settings   from './pages/Settings';

function Layout({ children }) {
  const { platform, cssVars, theme } = usePlatform();
  return (
    <div
      data-platform={platform}
      style={{
        ...cssVars,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: theme.background,
      }}
    >
      <Navbar />
      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      <Route path="/" element={
        <ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>
      } />

      <Route path="/locations" element={
        <ProtectedRoute><Layout><Locations /></Layout></ProtectedRoute>
      } />

      <Route path="/placements" element={
        <ProtectedRoute><Layout><Placements /></Layout></ProtectedRoute>
      } />

      <Route path="/ads" element={
        <ProtectedRoute><Layout><Ads /></Layout></ProtectedRoute>
      } />

      <Route path="/settings" element={
        <ProtectedRoute adminOnly><Layout><Settings /></Layout></ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PlatformProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </PlatformProvider>
    </AuthProvider>
  );
}
