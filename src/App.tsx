import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useDispatchEngine } from "@/hooks/useDispatchEngine";
import { ThemeSync } from "@/components/ThemeSync";
import React, { Suspense } from "react";

// Lazy-load pages — each becomes a separate chunk
const AuthPage = React.lazy(() => import("./pages/AuthPage"));
const ClientDashboard = React.lazy(() => import("./pages/ClientDashboard"));
const DriverDashboard = React.lazy(() => import("./pages/DriverDashboard"));
const AdminDashboardPage = React.lazy(() => import("./pages/AdminDashboardPage"));
const AdminCorridas = React.lazy(() => import("./pages/AdminCorridas"));
const AdminUsuarios = React.lazy(() => import("./pages/AdminUsuarios"));
const AdminPrecosTarifas = React.lazy(() => import("./pages/AdminPrecosTarifas"));
const AdminPrecosHorarios = React.lazy(() => import("./pages/AdminPrecosHorarios"));
const AdminPrecosTabela = React.lazy(() => import("./pages/AdminPrecosTabela"));
const AdminConfig = React.lazy(() => import("./pages/AdminConfig"));
const AdminPerform = React.lazy(() => import("./pages/AdminPerform"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const CalculadoraDigitalRF = React.lazy(() => import("./pages/CalculadoraDigitalRF"));
const MotoristaDashboard = React.lazy(() => import("./pages/MotoristaDashboard"));
const MotoristaViagens = React.lazy(() => import("./pages/MotoristaViagens"));
const MotoristaDashboardAll = React.lazy(() => import("./pages/MotoristaDashboardAll"));
const MotoristaCredencial = React.lazy(() => import("./pages/MotoristaCredencial"));
const MotoristaEditPerfil = React.lazy(() => import("./pages/MotoristaEditPerfil"));
const MotoristaHistoricoViagens = React.lazy(() => import("./pages/MotoristaHistoricoViagens"));

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

        {user && effectiveScreen === 'admin' && <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />}
        {user && effectiveScreen === 'admin' && <Route path="/admin/dashboard" element={<AdminDashboardPage />} />}
        {user && effectiveScreen === 'admin' && <Route path="/admin/corridas" element={<AdminCorridas />} />}
        {user && effectiveScreen === 'admin' && <Route path="/admin/usuarios" element={<AdminUsuarios />} />}
        {user && effectiveScreen === 'admin' && <Route path="/admin/precos" element={<Navigate to="/admin/precos/tabela" replace />} />}
        {user && effectiveScreen === 'admin' && <Route path="/admin/precos/config/tarifas" element={<AdminPrecosTarifas />} />}
        {user && effectiveScreen === 'admin' && <Route path="/admin/precos/config/horarios" element={<AdminPrecosHorarios />} />}
        {user && effectiveScreen === 'admin' && <Route path="/admin/precos/tabela" element={<AdminPrecosTabela />} />}
        {user && effectiveScreen === 'admin' && <Route path="/admin/perform" element={<AdminPerform />} />}
        {user && effectiveScreen === 'admin' && <Route path="/admin/config" element={<AdminConfig />} />}

        {/* Motorista routes */}
        {user && <Route path="/motorista/dashboard" element={<MotoristaDashboard />} />}
        {user && <Route path="/motorista/viagens" element={<MotoristaViagens />} />}
        {user && <Route path="/motorista/dashboardall" element={<MotoristaDashboardAll />} />}
        {user && <Route path="/motorista/credencial" element={<MotoristaCredencial />} />}
        {user && <Route path="/motorista/editperfil" element={<MotoristaEditPerfil />} />}
        {user && <Route path="/motorista/historico" element={<MotoristaHistoricoViagens />} />}

        {/* Redirect /admin for motorista to /motorista/dashboard */}
        {user && effectiveScreen === 'motorista' && <Route path="/admin" element={<Navigate to="/motorista/dashboard" replace />} />}
        {user && effectiveScreen === 'cliente' && <Route path="/admin" element={<Navigate to="/motorista/dashboard" replace />} />}
        {user && !effectiveScreen && <Route path="/admin" element={<Navigate to="/motorista/dashboard" replace />} />}
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
      <ThemeSync />
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
