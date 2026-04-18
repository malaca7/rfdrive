import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Navigation, Loader2, Phone, Eye, EyeOff } from 'lucide-react';
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
    <div className="h-[100dvh] w-full bg-background flex flex-col items-center justify-center px-[6%]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[min(100%,420px)]"
      >
        <div className="text-center mb-[8%]">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            className="inline-flex items-center justify-center w-[18%] max-w-[72px] aspect-square rounded-2xl gradient-accent mb-[3%] shadow-lg shadow-[hsl(45_100%_50%/0.3)] glow-accent overflow-hidden"
          >
            {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-cover" /> : <Navigation className="w-[45%] h-[45%] text-white" />}
          </motion.div>
          <h1 className="text-[clamp(1.75rem,6vw,2.5rem)] font-extrabold text-white tracking-tight">{nomePlataforma}</h1>
          <p className="text-white/40 text-[clamp(0.8rem,2.5vw,0.95rem)] mt-1">{slogan}</p>
        </div>

        <Card className="bg-card/90 backdrop-blur-2xl border border-white/[0.06] rounded-3xl overflow-hidden">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-[clamp(1.1rem,3.5vw,1.3rem)] text-white">{isLogin ? 'Entrar' : 'Criar Conta'}</CardTitle>
            <CardDescription className="text-[clamp(0.7rem,2.2vw,0.8rem)] text-white/40">
              {isLogin ? 'Acesse sua conta para solicitar corridas' : 'Cadastre-se para começar'}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-[6%] pb-[6%]">
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-1.5">
                  <Label htmlFor="nome" className="text-xs font-semibold text-white/60">Nome</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome completo"
                    required={!isLogin}
                    className="h-12 rounded-2xl text-sm bg-white/[0.05] border-white/[0.08] text-white placeholder:text-white/25 focus:border-[hsl(45_100%_50%)] focus:ring-[hsl(45_100%_50%/0.2)]"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="telefone" className="text-xs font-semibold text-white/60">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <Input
                    id="telefone"
                    type="tel"
                    value={telefone}
                    onChange={handlePhoneChange}
                    placeholder="(11) 99999-9999"
                    className="pl-10 h-12 rounded-2xl text-sm bg-white/[0.05] border-white/[0.08] text-white placeholder:text-white/25 focus:border-[hsl(45_100%_50%)] focus:ring-[hsl(45_100%_50%/0.2)]"
                    required
                    maxLength={16}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-white/60">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="pr-10 h-12 rounded-2xl text-sm bg-white/[0.05] border-white/[0.08] text-white placeholder:text-white/25 focus:border-[hsl(45_100%_50%)] focus:ring-[hsl(45_100%_50%/0.2)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/[0.05] text-[hsl(45_100%_50%)] focus:ring-[hsl(45_100%_50%/0.3)] accent-[hsl(45,100%,50%)]"
                />
                <span className="text-xs text-white/50">Lembrar meu login</span>
              </label>
              <Button
                type="submit"
                className="w-full h-12 rounded-2xl btn-themed font-bold text-sm"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isLogin ? 'Entrar' : 'Criar Conta'}
              </Button>
            </form>

          </CardContent>
        </Card>
        <div className="mt-5 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => { window.location.hash = '/calculadora'; }}
            className="text-[clamp(0.75rem,2.2vw,0.85rem)] text-white/40 hover:text-[hsl(45_100%_50%)] transition-colors flex items-center gap-1.5"
          >
            📱 Calculadora Digital
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
