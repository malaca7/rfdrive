import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { Navigation, Loader2, Phone, Eye, EyeOff, Lock } from 'lucide-react';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { useToast } from '@/hooks/use-toast';

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

const AuthPage: React.FC = () => {
  const isLogin = true;
  const [telefone, setTelefone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('localizzou_remember') === 'true');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const { nomePlataforma, logoUrl, slogan } = usePlatformConfig();

  // Load saved credentials on mount
  useEffect(() => {
    if (localStorage.getItem('localizzou_remember') === 'true') {
      const savedPhone = localStorage.getItem('localizzou_saved_phone') || '';
      const savedPass = localStorage.getItem('localizzou_saved_pass') || '';
      if (savedPhone) setTelefone(formatPhone(savedPhone));
      if (savedPass) setPassword(savedPass);
    }
  }, []);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefone(formatPhone(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = telefone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      toast({ title: 'Telefone inválido', description: 'Informe um número com DDD.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        const ok = await signIn(telefone, password);
        if (!ok) {
          toast({
            title: 'Credenciais inválidas',
            description: 'Verifique seu telefone e senha.',
            variant: 'destructive',
          });
        } else if (rememberMe) {
          localStorage.setItem('localizzou_remember', 'true');
          localStorage.setItem('localizzou_saved_phone', telefone.replace(/\D/g, ''));
          localStorage.setItem('localizzou_saved_pass', password);
        } else {
          localStorage.removeItem('localizzou_remember');
          localStorage.removeItem('localizzou_saved_phone');
          localStorage.removeItem('localizzou_saved_pass');
        }
      } else {
        await signUp(telefone, password, nome);
        toast({ title: 'Conta criada!', description: 'Você já pode fazer login.' });
      }
    } catch (err: unknown) {
      toast({
        title: isLogin ? 'Erro no login' : 'Erro no cadastro',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-background flex flex-col overflow-hidden">
      {/* Top section — branding */}
      <div className="flex-1 flex flex-col items-center justify-end pb-6 px-6">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 180, delay: 0.05 }}
          className="w-20 h-20 rounded-3xl gradient-accent flex items-center justify-center shadow-xl shadow-accent/30 glow-accent overflow-hidden mb-4"
        >
          {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-cover" /> : <Navigation className="w-9 h-9 text-white" />}
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-3xl font-extrabold text-white tracking-tight"
        >
          {nomePlataforma}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-white/50 text-sm mt-1"
        >
          {slogan}
        </motion.p>
      </div>

      {/* Bottom section — form panel */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 120, delay: 0.2 }}
        className="bg-card/90 backdrop-blur-2xl border-t border-white/[0.1] rounded-t-[2rem] px-6 pt-7 pb-safe-bottom shadow-[0_-8px_30px_rgba(0,0,0,0.4)]"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
          {!isLogin && (
            <div className="relative">
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                required={!isLogin}
                className="h-13 rounded-2xl text-sm bg-white/[0.06] border-white/[0.12] text-white placeholder:text-white/35 focus:border-accent focus:ring-accent/20 pl-4"
              />
            </div>
          )}

          {/* Phone */}
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/40" />
            <Input
              id="telefone"
              type="tel"
              value={telefone}
              onChange={handlePhoneChange}
              placeholder="(00) 00000-0000"
              className="h-13 rounded-2xl text-sm bg-white/[0.06] border-white/[0.12] text-white placeholder:text-white/35 focus:border-accent focus:ring-accent/20 pl-11"
              required
              maxLength={16}
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/40" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              required
              minLength={6}
              className="h-13 rounded-2xl text-sm bg-white/[0.06] border-white/[0.12] text-white placeholder:text-white/35 focus:border-accent focus:ring-accent/20 pl-11 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
            </button>
          </div>

          {/* Remember me */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none group">
            <button
              type="button"
              onClick={() => setRememberMe(v => !v)}
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 shrink-0 ${
                rememberMe
                  ? 'bg-accent border-accent shadow-[0_0_8px_hsl(var(--accent)/0.4)]'
                  : 'border-white/20 bg-white/[0.05] group-hover:border-white/30'
              }`}
            >
              {rememberMe && (
                <svg className="w-3 h-3 text-accent-foreground" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.5 6L5 8.5L9.5 3.5" />
                </svg>
              )}
            </button>
            <span className={`text-xs transition-colors ${rememberMe ? 'text-white/80' : 'text-white/50 group-hover:text-white/60'}`}>
              Lembrar meu login
            </span>
          </label>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-13 rounded-2xl btn-themed font-bold text-base shadow-lg shadow-accent/20"
            disabled={loading}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            {isLogin ? 'Entrar' : 'Criar Conta'}
          </Button>
        </form>

        {/* Calculadora link */}
        <div className="mt-5 mb-2 flex justify-center">
          <button
            type="button"
            onClick={() => { window.location.hash = '/calculadora'; }}
            className="text-xs text-white/45 hover:text-accent transition-colors flex items-center gap-1.5"
          >
            📱 Calculadora Digital
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
