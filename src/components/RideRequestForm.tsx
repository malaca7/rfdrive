import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, Loader2, MapPin, Navigation, Clock, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ParsedRide {
  origem: string;
  destino: string;
  horario: string;
}

const RideRequestForm: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsed, setParsed] = useState<ParsedRide | null>(null);
  const [isSending, setIsSending] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const processWithAI = async (input: string) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-ride', {
        body: { text: input },
      });
      if (error) throw error;
      if (data?.origem && data?.destino) {
        setParsed(data as ParsedRide);
      } else {
        toast({
          title: 'Não foi possível interpretar',
          description: 'Tente descrever melhor a origem e destino.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({ title: 'Erro ao processar', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = () => {
    if (!text.trim()) return;
    processWithAI(text.trim());
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: 'Microfone não suportado',
        description: 'Use HTTPS ou um navegador compatível (Chrome, Firefox, Edge).',
        variant: 'destructive',
      });
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        toast({
          title: 'Permissão negada',
          description: 'Permita o acesso ao microfone nas configurações do navegador e tente novamente.',
          variant: 'destructive',
        });
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        toast({
          title: 'Microfone não encontrado',
          description: 'Nenhum microfone foi detectado no dispositivo.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Não foi possível acessar o microfone',
          description: err instanceof Error ? err.message : 'Erro desconhecido.',
          variant: 'destructive',
        });
      }
      return;
    }

    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        setIsProcessing(true);
        try {
          const { data, error } = await supabase.functions.invoke('parse-ride', {
            body: { audio: base64 },
          });
          if (error) throw error;
          if (data?.transcription) setText(data.transcription);
          if (data?.origem && data?.destino) {
            setParsed(data as ParsedRide);
          }
        } catch {
          toast({ title: 'Erro ao processar áudio', variant: 'destructive' });
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(blob);
    };

    mediaRecorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const confirmRide = async () => {
    if (!parsed || !user) return;
    setIsSending(true);
    try {
      const { error } = await supabase.from('corridas').insert({
        cliente_id: user.id,
        origem_texto: parsed.origem,
        destino_texto: parsed.destino,
        horario_estimado: parsed.horario || null,
      });
      if (error) throw error;
      toast({ title: 'Corrida solicitada!', description: 'Aguardando um motorista aceitar.' });
      setParsed(null);
      setText('');
    } catch {
      toast({ title: 'Erro ao solicitar corrida', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Para onde você quer ir?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Ex: "Me pega no Shopping Iguatemi e leva pro aeroporto às 18h"'
            className="min-h-[100px] text-base resize-none"
          />
          <div className="flex gap-3">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              variant={isRecording ? 'destructive' : 'secondary'}
              size="lg"
              className="relative"
            >
              {isRecording ? (
                <>
                  <MicOff className="w-5 h-5 mr-2" />
                  Parar
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-destructive animate-pulse-ring" />
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 mr-2" />
                  Gravar Áudio
                </>
              )}
            </Button>
            <Button
              onClick={handleTextSubmit}
              disabled={!text.trim() || isProcessing}
              size="lg"
              className="flex-1 gradient-accent text-accent-foreground font-semibold hover:opacity-90"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Send className="w-5 h-5 mr-2" />
              )}
              {isProcessing ? 'Processando...' : 'Enviar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {parsed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="border-accent/30 bg-accent/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Check className="w-5 h-5 text-success" />
                  Confirme sua corrida
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-success mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Origem</p>
                      <p className="font-medium">{parsed.origem}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Navigation className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Destino</p>
                      <p className="font-medium">{parsed.destino}</p>
                    </div>
                  </div>
                  {parsed.horario && (
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Horário</p>
                        <p className="font-medium">{parsed.horario}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setParsed(null)} className="flex-1">
                    Editar
                  </Button>
                  <Button
                    onClick={confirmRide}
                    disabled={isSending}
                    className="flex-1 gradient-accent text-accent-foreground font-semibold hover:opacity-90"
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Confirmar Corrida
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RideRequestForm;
