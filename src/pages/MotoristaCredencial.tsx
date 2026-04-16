import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import AppShell from '@/components/AppShell';
import { DriverBadge } from '@/components/DriverTools';
import { Loader2 } from 'lucide-react';

const MotoristaCredencial: React.FC = () => {
  const { user } = useAuth();

  const { data: fullProfile, isLoading: loadingProfile } = useQuery({
    queryKey: ['driver-full-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, telefone, tipo, status, veiculo_marca, veiculo_modelo, veiculo_cor, veiculo_placa, avatar_url')
        .eq('id', user!.id)
        .single();
      if (error) {
        const { data: fallback, error: err2 } = await supabase
          .from('users')
          .select('id, nome, telefone, tipo, status, veiculo_marca, veiculo_modelo, veiculo_cor, veiculo_placa')
          .eq('id', user!.id)
          .single();
        if (err2) throw err2;
        return { ...fallback, avatar_url: null };
      }
      return data;
    },
    enabled: !!user,
  });

  const { data: avgRating } = useQuery({
    queryKey: ['driver-avg-rating', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes')
        .select('nota')
        .eq('motorista_id', user!.id);
      if (error) throw error;
      if (!data || data.length === 0) return null;
      const avg = data.reduce((sum, r) => sum + r.nota, 0) / data.length;
      return { avg: Math.round(avg * 10) / 10, count: data.length };
    },
    enabled: !!user,
  });

  const { data: completedCount } = useQuery({
    queryKey: ['driver-completed-count', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('corridas')
        .select('id', { count: 'exact', head: true })
        .eq('motorista_id', user!.id)
        .in('status', ['aprovada', 'finalizada']);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  return (
    <AppShell>
      <div className="w-full px-[4%] py-[3%] max-w-2xl mx-auto">
        {loadingProfile ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : fullProfile ? (
          <DriverBadge
            profile={fullProfile}
            avgRating={avgRating || null}
            completedCount={completedCount || 0}
          />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Perfil não encontrado
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default MotoristaCredencial;
