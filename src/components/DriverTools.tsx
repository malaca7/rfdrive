import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Calculator, MapPin, Navigation, DollarSign, Send, Check, Copy,
  Car, Phone, Star, User, Shield, Clock, MessageSquare, ChevronRight,
} from 'lucide-react';
import { usePrecoTabela, useAllLocations } from '@/hooks/usePrecoTabela';
import { normalizeText } from '@/lib/tabela-preco';
import { useToast } from '@/hooks/use-toast';

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════
interface DriverProfile {
  id: string;
  nome: string;
  telefone: string;
  tipo: string;
  status: string;
  veiculo_marca?: string | null;
  veiculo_modelo?: string | null;
  veiculo_cor?: string | null;
  veiculo_placa?: string | null;
}

interface DriverToolsProps {
  profile: DriverProfile;
  avgRating: { avg: number; count: number } | null;
  completedCount: number;
}

// ═══════════════════════════════════════════════
// Trip Calculator
// ═══════════════════════════════════════════════
export const TripCalculator: React.FC<{
  onSendQuote?: (data: { origem: string; destino: string; valor: number; mensagem: string }) => void;
}> = ({ onSendQuote }) => {
  const { toast } = useToast();
  const allLocations = useAllLocations();

  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [showOrigemSugg, setShowOrigemSugg] = useState(false);
  const [showDestinoSugg, setShowDestinoSugg] = useState(false);
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [observacao, setObservacao] = useState('');
  const [copied, setCopied] = useState(false);

  const filteredOrigens = useMemo(() => {
    if (!origem.trim()) return allLocations;
    const q = normalizeText(origem);
    return allLocations.filter(o => normalizeText(o).includes(q));
  }, [origem, allLocations]);

  const filteredDestinos = useMemo(() => {
    if (!destino.trim()) return allLocations;
    const q = normalizeText(destino);
    return allLocations.filter(d => normalizeText(d).includes(q));
  }, [destino, allLocations]);

  const preco = usePrecoTabela(origem, destino);

  const quoteMensagem = useMemo(() => {
    if (!preco || !origem.trim() || !destino.trim()) return '';
    const lines = [
      `🚗 *Orçamento RF Drive*`,
      ``,
      `📍 *Origem:* ${origem.trim()}`,
      `📍 *Destino:* ${destino.trim()}`,
      `💰 *Valor:* R$ ${preco.valor.toFixed(2)}`,
      preco.estimado ? `_(valor estimado)_` : '',
      ``,
    ];
    if (clienteNome.trim()) lines.push(`👤 *Cliente:* ${clienteNome.trim()}`);
    if (observacao.trim()) lines.push(`📝 *Obs:* ${observacao.trim()}`);
    lines.push(``, `_Consulta feita pela Tabela RF Drive_`);
    return lines.filter(Boolean).join('\n');
  }, [preco, origem, destino, clienteNome, observacao]);

  const handleCopy = async () => {
    if (!quoteMensagem) return;
    try {
      await navigator.clipboard.writeText(quoteMensagem);
      setCopied(true);
      toast({ title: 'Copiado!' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  const handleWhatsApp = () => {
    if (!quoteMensagem) return;
    const phone = clienteTelefone.replace(/\D/g, '');
    const url = phone
      ? `https://wa.me/55${phone}?text=${encodeURIComponent(quoteMensagem)}`
      : `https://wa.me/?text=${encodeURIComponent(quoteMensagem)}`;
    window.open(url, '_blank');
  };

  const handleSendQuote = () => {
    if (!preco) return;
    onSendQuote?.({ origem: origem.trim(), destino: destino.trim(), valor: preco.valor, mensagem: quoteMensagem });
    toast({ title: 'Orçamento enviado!' });
  };

  const handleClear = () => {
    setOrigem('');
    setDestino('');
    setClienteNome('');
    setClienteTelefone('');
    setObservacao('');
  };

  return (
    <div className="space-y-4">
      {/* Origem */}
      <Card>
        <CardContent className="py-4 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Calculator className="w-4 h-4 text-accent" />
            Calcular Viagem
          </h3>

          <div className="space-y-3">
            {/* Origem */}
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <label className="text-xs font-medium">Origem</label>
              </div>
              <Input
                value={origem}
                onChange={e => { setOrigem(e.target.value); setShowOrigemSugg(true); }}
                onFocus={() => setShowOrigemSugg(true)}
                onBlur={() => setTimeout(() => setShowOrigemSugg(false), 200)}
                placeholder="Digite a origem..."
              />
              {showOrigemSugg && filteredOrigens.length > 0 && origem.trim() && (
                <div className="absolute z-20 top-full mt-1 w-full bg-card border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {filteredOrigens.slice(0, 8).map(loc => (
                    <button
                      key={loc}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                      onMouseDown={() => { setOrigem(loc); setShowOrigemSugg(false); }}
                    >
                      <MapPin className="w-3 h-3 inline mr-1.5 text-green-400" />{loc}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Destino */}
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                <label className="text-xs font-medium">Destino</label>
              </div>
              <Input
                value={destino}
                onChange={e => { setDestino(e.target.value); setShowDestinoSugg(true); }}
                onFocus={() => setShowDestinoSugg(true)}
                onBlur={() => setTimeout(() => setShowDestinoSugg(false), 200)}
                placeholder="Digite o destino..."
              />
              {showDestinoSugg && filteredDestinos.length > 0 && destino.trim() && (
                <div className="absolute z-20 top-full mt-1 w-full bg-card border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {filteredDestinos.slice(0, 8).map(loc => (
                    <button
                      key={loc}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                      onMouseDown={() => { setDestino(loc); setShowDestinoSugg(false); }}
                    >
                      <Navigation className="w-3 h-3 inline mr-1.5 text-accent" />{loc}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Result */}
          {preco && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center space-y-1">
              <p className="text-xs text-muted-foreground">Valor da corrida</p>
              <p className="text-[clamp(1.5rem,5vw,2rem)] font-extrabold text-green-400">
                R$ {preco.valor.toFixed(2)}
              </p>
              {preco.estimado && (
                <Badge variant="outline" className="text-[10px] text-yellow-400 border-yellow-500/30">
                  Valor estimado (via hub)
                </Badge>
              )}
              {!preco.match_exato && !preco.estimado && (
                <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30">
                  Match aproximado
                </Badge>
              )}
              <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground pt-1">
                <MapPin className="w-2.5 h-2.5" /> {preco.origem_tabela}
                <ChevronRight className="w-3 h-3" />
                <Navigation className="w-2.5 h-2.5" /> {preco.destino_tabela}
              </div>
              {preco.regiao && (
                <p className="text-[10px] text-muted-foreground">Região: {preco.regiao}</p>
              )}
            </div>
          )}

          {!preco && origem.trim() && destino.trim() && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
              <p className="text-sm text-red-400">Rota não encontrada na tabela</p>
              <p className="text-[10px] text-muted-foreground">Verifique origem e destino</p>
            </div>
          )}

          {(origem || destino) && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={handleClear}>
              Limpar campos
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Send Quote */}
      {preco && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-400" />
              Enviar Orçamento
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Nome do cliente</label>
                <Input
                  value={clienteNome}
                  onChange={e => setClienteNome(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Telefone</label>
                <Input
                  value={clienteTelefone}
                  onChange={e => setClienteTelefone(e.target.value)}
                  placeholder="(81) 9xxxx-xxxx"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">Observação</label>
              <Textarea
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                placeholder="Horário, ponto de referência..."
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Preview */}
            <div className="bg-muted/30 rounded-lg p-3 text-xs whitespace-pre-wrap font-mono leading-relaxed">
              {quoteMensagem}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline" className="flex-1 gap-1.5 text-xs"
                onClick={handleCopy}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado!' : 'Copiar'}
              </Button>
              <Button
                className="flex-1 gap-1.5 text-xs bg-green-600 hover:bg-green-700"
                onClick={handleWhatsApp}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════
// Driver Badge / Credential Card
// ═══════════════════════════════════════════════
export const DriverBadge: React.FC<DriverToolsProps> = ({ profile, avgRating, completedCount }) => {
  const { toast } = useToast();
  const hasVehicle = profile.veiculo_marca || profile.veiculo_placa;

  const handleShare = async () => {
    const text = [
      `🚗 RF Drive - Motorista Credenciado`,
      `👤 ${profile.nome}`,
      `📱 ${profile.telefone}`,
      hasVehicle ? `🚘 ${profile.veiculo_marca || ''} ${profile.veiculo_modelo || ''} - ${profile.veiculo_cor || ''} (${profile.veiculo_placa || ''})` : '',
      avgRating ? `⭐ ${avgRating.avg}/5 (${avgRating.count} avaliações)` : '',
      `✅ ${completedCount} corridas concluídas`,
    ].filter(Boolean).join('\n');

    try {
      if (navigator.share) {
        await navigator.share({ title: 'RF Drive - Crachá', text });
      } else {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Crachá copiado!' });
      }
    } catch {
      /* user cancelled share */
    }
  };

  return (
    <div className="space-y-4">
      {/* Badge Card */}
      <Card className="border-accent/30 overflow-hidden">
        {/* Header stripe */}
        <div className="h-2 gradient-accent" />

        <CardContent className="pt-6 pb-6 space-y-5">
          {/* Logo + Title */}
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-3">
              <Car className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-lg font-extrabold tracking-tight">RF Drive</h2>
            <p className="text-xs text-muted-foreground">Motorista Credenciado</p>
          </div>

          <Separator />

          {/* Driver info */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                <User className="w-4.5 h-4.5 text-blue-400" />
              </div>
              <div>
                <p className="font-semibold">{profile.nome}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {profile.telefone}
                </p>
              </div>
            </div>

            {/* Vehicle */}
            {hasVehicle ? (
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-accent" /> Veículo
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {profile.veiculo_marca && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Marca / Modelo</p>
                      <p className="text-sm font-medium">
                        {profile.veiculo_marca} {profile.veiculo_modelo || ''}
                      </p>
                    </div>
                  )}
                  {profile.veiculo_cor && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Cor</p>
                      <p className="text-sm font-medium">{profile.veiculo_cor}</p>
                    </div>
                  )}
                  {profile.veiculo_placa && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Placa</p>
                      <p className="text-sm font-mono font-bold">{profile.veiculo_placa}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center">
                <p className="text-xs text-yellow-400">Veículo não cadastrado</p>
                <p className="text-[10px] text-muted-foreground">Solicite ao admin para adicionar</p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-green-500/10 rounded-lg p-3 text-center">
                <p className="text-lg font-extrabold text-green-400">{completedCount}</p>
                <p className="text-[10px] text-muted-foreground">Corridas</p>
              </div>
              <div className="bg-yellow-500/10 rounded-lg p-3 text-center">
                {avgRating ? (
                  <>
                    <div className="flex items-center justify-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-lg font-extrabold text-yellow-400">{avgRating.avg}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{avgRating.count} aval.</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-extrabold text-muted-foreground">—</p>
                    <p className="text-[10px] text-muted-foreground">Sem aval.</p>
                  </>
                )}
              </div>
              <div className="bg-accent/10 rounded-lg p-3 text-center">
                <Badge
                  variant={profile.status === 'ativo' ? 'outline' : 'destructive'}
                  className="text-[10px] px-1.5"
                >
                  {profile.status === 'ativo' ? '✅ Ativo' : '🚫 ' + profile.status}
                </Badge>
                <p className="text-[10px] text-muted-foreground mt-1">Status</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* ID */}
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">ID do Motorista</p>
            <p className="text-xs font-mono text-muted-foreground/70">{profile.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </CardContent>
      </Card>

      {/* Share button */}
      <Button
        className="w-full gap-2"
        variant="outline"
        onClick={handleShare}
      >
        <Send className="w-4 h-4" />
        Compartilhar Crachá
      </Button>
    </div>
  );
};
