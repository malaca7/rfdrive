import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import AuthPage from "./pages/AuthPage";
import ClientDashboard from "./pages/ClientDashboard";
import DriverDashboard from "./pages/DriverDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, activeScreen, loading, roles } = useAuth();
  useRealtimeSync();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  const isAdmin = user.tipo === 'admin' || roles.includes('admin');
  const effectiveScreen = isAdmin && activeScreen !== 'motorista' ? 'admin' : activeScreen;

  return (
    <Routes>
      {effectiveScreen === 'admin' && <Route path="/" element={<AdminDashboard />} />}
      {effectiveScreen === 'motorista' && <Route path="/" element={<DriverDashboard />} />}
      {effectiveScreen === 'cliente' && <Route path="/" element={<ClientDashboard />} />}
      {!effectiveScreen && <Route path="/" element={<ClientDashboard />} />}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
