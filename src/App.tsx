import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useDispatchEngine } from "@/hooks/useDispatchEngine";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { ThemeSync } from "@/components/ThemeSync";
import React, { Suspense } from "react";
import { useAppUpdate } from "@/hooks/useAppUpdate";

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
const NotFound = React.lazy(() => import("./pages/NotFound"));
const CalculadoraDigitalRF = React.lazy(() => import("./pages/CalculadoraDigitalRF"));
const MotoristaDashboard = React.lazy(() => import("./pages/MotoristaDashboard"));
const MotoristaViagens = React.lazy(() => import("./pages/MotoristaViagens"));
const MotoristaDashboardAll = React.lazy(() => import("./pages/MotoristaDashboardAll"));
const MotoristaCredencial = React.lazy(() => import("./pages/MotoristaCredencial"));
const MotoristaEditPerfil = React.lazy(() => import("./pages/MotoristaEditPerfil"));
const MotoristaHistoricoViagens = React.lazy(() => import("./pages/MotoristaHistoricoViagens"));
const AdminAvaliacaoLinks = React.lazy(() => import("./pages/AdminAvaliacaoLinks"));
const AdminRecibos = React.lazy(() => import("./pages/AdminRecibos"));
const AvaliacaoPublica = React.lazy(() => import("./pages/AvaliacaoPublica"));
const AdminNotifications = React.lazy(() => import("./pages/AdminNotifications"));
const DownloadApp = React.lazy(() => import("./pages/DownloadApp"));
// CEO pages
const CeoDashboard = React.lazy(() => import("./pages/CeoDashboard"));
const CeoAdmins = React.lazy(() => import("./pages/CeoAdmins"));
const CeoAdminHub = React.lazy(() => import("./pages/CeoAdminHub"));
const CeoLogs = React.lazy(() => import("./pages/CeoLogs"));
const CeoConfig = React.lazy(() => import("./pages/CeoConfig"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

const UpdatePrompt = () => {
  const { updateAvailable, doUpdate } = useAppUpdate();
  if (!updateAvailable) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full text-center space-y-4">
        <div className="text-4xl">🚀</div>
        <h2 className="text-lg font-bold">Nova versão disponível!</h2>
        <p className="text-sm text-muted-foreground">
          Versão <span className="font-semibold text-foreground">{updateAvailable.versionName}</span> disponível.
          Atualize para ter as últimas melhorias.
        </p>
        <button
          onClick={doUpdate}
          className="w-full h-12 rounded-xl font-semibold text-white bg-accent hover:bg-accent/90 transition-colors text-base"
        >
          Atualizar agora
        </button>
      </div>
    </div>
  );
};

const AppRoutes = () => {
  const { user, activeScreen, loading, roles } = useAuth();
  useRealtimeSync();
  usePushNotifications();

  const tipoNormalized = String(user?.tipo || '').toLowerCase();
  const rolesNormalized = roles.map(r => String(r).toLowerCase());

  // Dispatch engine runs when admin/ceo is logged in
  const isAdmin = !loading && !!user && (tipoNormalized === 'admin' || tipoNormalized === 'ceo' || rolesNormalized.includes('admin') || rolesNormalized.includes('ceo'));
  useDispatchEngine(!!isAdmin);

  if (loading) {
    return <PageLoader />;
  }

  const isCEO = !!user && (tipoNormalized === 'ceo' || rolesNormalized.includes('ceo'));
  const effectiveScreen = isCEO && activeScreen === 'ceo' ? 'ceo'
    : isAdmin && activeScreen === 'admin' ? 'admin'
    : activeScreen;

  const defaultDashboard = effectiveScreen === 'ceo' ? '/ceo/dashboard'
    : effectiveScreen === 'admin' ? '/admin/dashboard'
    : '/motorista/viagens';

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Rotas públicas */}
        <Route path="/" element={
          user
            ? <Navigate to={defaultDashboard} replace />
            : <AuthPage />
        } />
        <Route path="/calculadora" element={<CalculadoraDigitalRF />} />
        <Route path="/calculadora-digital-RF" element={<CalculadoraDigitalRF />} />
        <Route path="/avaliar/:token" element={<AvaliacaoPublica />} />
        <Route path="/download" element={<DownloadApp />} />

        {/* Painel CEO — apenas CEO */}
        {!user && <Route path="/ceo/*" element={<Navigate to="/" replace />} />}
        {user && isCEO && <Route path="/ceo" element={<Navigate to="/ceo/dashboard" replace />} />}
        {user && isCEO && <Route path="/ceo/dashboard" element={<CeoDashboard />} />}
        {user && isCEO && <Route path="/ceo/admins" element={<Navigate to="/ceo/admin" replace />} />}
        {user && isCEO && <Route path="/ceo/admin" element={<CeoAdminHub />} />}
        {user && isCEO && <Route path="/ceo/logs" element={<CeoLogs />} />}
        {user && isCEO && <Route path="/ceo/config" element={<CeoConfig />} />}
        {user && !isCEO && <Route path="/ceo/*" element={<Navigate to="/" replace />} />}

        {/* Painel admin */}
        {!user && <Route path="/admin/login" element={<Navigate to="/" replace />} />}
        {!user && <Route path="/admin/*" element={<Navigate to="/" replace />} />}

        {user && (effectiveScreen === 'admin' || effectiveScreen === 'ceo') && <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />}
        {user && (effectiveScreen === 'admin' || effectiveScreen === 'ceo') && <Route path="/admin/dashboard" element={<AdminDashboardPage />} />}
        {user && (effectiveScreen === 'admin' || effectiveScreen === 'ceo') && <Route path="/admin/corridas" element={<AdminCorridas />} />}
        {user && (effectiveScreen === 'admin' || effectiveScreen === 'ceo') && <Route path="/admin/usuarios" element={<AdminUsuarios />} />}
        {user && (effectiveScreen === 'admin' || effectiveScreen === 'ceo') && <Route path="/admin/precos" element={<Navigate to="/admin/precos/config/tarifas" replace />} />}
        {user && (effectiveScreen === 'admin' || effectiveScreen === 'ceo') && <Route path="/admin/precos/config/tarifas" element={<AdminPrecosTarifas />} />}
        {user && (effectiveScreen === 'admin' || effectiveScreen === 'ceo') && <Route path="/admin/precos/config/horarios" element={<AdminPrecosHorarios />} />}
        {user && (effectiveScreen === 'admin' || effectiveScreen === 'ceo') && <Route path="/admin/precos/tabela" element={<AdminPrecosTabela />} />}
        {user && (effectiveScreen === 'admin' || effectiveScreen === 'ceo') && <Route path="/admin/config" element={<AdminConfig />} />}
        {user && (effectiveScreen === 'admin' || effectiveScreen === 'ceo') && <Route path="/admin/avaliacoes-links" element={<AdminAvaliacaoLinks />} />}
        {user && (effectiveScreen === 'admin' || effectiveScreen === 'ceo') && <Route path="/admin/recibos" element={<AdminRecibos />} />}
        {user && (effectiveScreen === 'admin' || effectiveScreen === 'ceo') && <Route path="/admin/notifications" element={<AdminNotifications />} />}

        {/* Motorista routes */}
        {user && <Route path="/motorista/dashboard" element={<MotoristaDashboard />} />}
        {user && <Route path="/motorista/viagens" element={<MotoristaViagens />} />}
        {user && <Route path="/motorista/dashboardall" element={<MotoristaDashboardAll />} />}
        {user && <Route path="/motorista/credencial" element={<MotoristaCredencial />} />}
        {user && <Route path="/motorista/editperfil" element={<MotoristaEditPerfil />} />}
        {user && <Route path="/motorista/historico" element={<MotoristaHistoricoViagens />} />}

        {/* Redirect non-admin/ceo to motorista */}
        {user && effectiveScreen === 'motorista' && <Route path="/admin" element={<Navigate to="/motorista/viagens" replace />} />}
        {user && effectiveScreen === 'cliente' && <Route path="/admin" element={<Navigate to="/motorista/viagens" replace />} />}
        {user && !effectiveScreen && <Route path="/admin" element={<Navigate to="/motorista/viagens" replace />} />}
        {user && <Route path="/admin/login" element={<Navigate to="/admin" replace />} />}
        {user && <Route path="/admin/*" element={<Navigate to="/admin" replace />} />}

        <Route path="/login" element={<Navigate to="/" replace />} />
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
      <UpdatePrompt />
      <BrowserRouter basename="/rfdrive">
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
