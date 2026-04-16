import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useDispatchEngine } from "@/hooks/useDispatchEngine";
import React, { Suspense } from "react";

// Lazy-load pages — each becomes a separate chunk
const AuthPage = React.lazy(() => import("./pages/AuthPage"));
const ClientDashboard = React.lazy(() => import("./pages/ClientDashboard"));
const DriverDashboard = React.lazy(() => import("./pages/DriverDashboard"));
const AdminDashboard = React.lazy(() => import("./pages/AdminDashboard"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const CalculadoraDigitalRF = React.lazy(() => import("./pages/CalculadoraDigitalRF"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const AppRoutes = () => {
  const { user, activeScreen, loading, roles } = useAuth();
  useRealtimeSync();

  // Etapa 19: Dispatch engine runs when admin is logged in
  const isAdmin = !loading && user && (user.tipo === 'admin' || roles.includes('admin'));
  useDispatchEngine(!!isAdmin);

  if (loading) {
    return <PageLoader />;
  }

  const effectiveScreen = isAdmin && activeScreen === 'admin' ? 'admin' : activeScreen;

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Rotas públicas */}
        <Route path="/" element={<CalculadoraDigitalRF />} />
        <Route path="/calculadora-digital-RF" element={<CalculadoraDigitalRF />} />

        {/* Painel admin */}
        {!user && <Route path="/admin/login" element={<AuthPage />} />}
        {!user && <Route path="/admin/*" element={<Navigate to="/admin/login" replace />} />}

        {user && effectiveScreen === 'admin' && <Route path="/admin" element={<AdminDashboard />} />}
        {user && effectiveScreen === 'motorista' && <Route path="/admin" element={<DriverDashboard />} />}
        {user && effectiveScreen === 'cliente' && <Route path="/admin" element={<DriverDashboard />} />}
        {user && !effectiveScreen && <Route path="/admin" element={<DriverDashboard />} />}
        {user && <Route path="/admin/login" element={<Navigate to="/admin" replace />} />}
        {user && <Route path="/admin/*" element={<Navigate to="/admin" replace />} />}

        {/* Compat: rota antiga /login redireciona */}
        <Route path="/login" element={<Navigate to="/admin/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
