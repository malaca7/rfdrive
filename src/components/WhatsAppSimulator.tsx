import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, Bot, User, Loader2, Phone, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'welcome',
    text: '👋 Olá! Sou o assistente da LocaliZZou.\n\nMe diga de onde você quer sair e para onde quer ir.\n\nExemplo: "Me pega na Praça Barão de Muribeca e me leva pro Shopping Costa Dourada"',
    sender: 'bot',
    timestamp: new Date(),
  },
];

const WhatsAppSimulator: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      text,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const phone = user?.telefone || '5500000000000';

      // Call the whatsapp-webhook edge function in simulator mode
      const { data, error } = await supabase.functions.invoke('whatsapp-webhook', {
        body: { phone, text, messageId: `sim_${Date.now()}` },
      });

      if (error) throw error;

      // Simulate bot response based on the outcome
      let botResponse = '';

      if (data?.latestRide) {
        const ride = data.latestRide;
        if (ride.status === 'nova') {
          botResponse =
            `🚗 *Confirme seu pedido:*\n\n` +
            `📍 Embarque: *${ride.origem_texto}*\n` +
            `🏁 Destino: *${ride.destino_texto}*\n` +
            (ride.horario_estimado ? `🕐 Horário: *${ride.horario_estimado}*\n` : '') +
            `\n*1* ✅ Confirmar\n*2* ✏️ Corrigir\n*3* ❌ Cancelar`;
        } else if (ride.status === 'aguardando_motorista') {
          botResponse =
            `✅ *Corrida confirmada!*\n\n` +
            `📍 De: ${ride.origem_texto}\n` +
            `🏁 Para: ${ride.destino_texto}\n\n` +
            `Aguardando um motorista aceitar sua corrida. 🚗`;
        } else if (ride.status === 'recusada') {
          botResponse = '❌ Corrida cancelada. Quando precisar, é só mandar uma mensagem! 😊';
        } else {
          botResponse = `📌 Corrida atualizada. Status: ${ride.status}`;
        }
      } else {
        // Generic response from parse or fallback
        if (text === '1' || text.toLowerCase() === 'confirmar') {
          botResponse = '✅ Corrida confirmada! Aguardando motorista... 🚗';
        } else if (text === '2' || text.toLowerCase() === 'corrigir') {
          botResponse = '✏️ Ok! Me diga novamente para onde você quer ir.';
        } else if (text === '3' || text.toLowerCase() === 'cancelar') {
          botResponse = '❌ Corrida cancelada. Quando precisar, mande uma mensagem!';
        } else {
          botResponse = '🤔 Não entendi. Me diga de onde quer sair e para onde quer ir.\n\nExemplo: "Da Praça Barão de Muribeca para o Shopping Costa Dourada"';
        }
      }

      const botMsg: Message = {
        id: `bot_${Date.now()}`,
        text: botResponse,
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error('WhatsApp sim error:', err);
      // If edge function not deployed, simulate locally
      const fallbackMsg: Message = {
        id: `bot_${Date.now()}`,
        text: '⚠️ Modo simulação (edge function não disponível).\n\nSua mensagem foi recebida. Em produção, a IA processaria e responderia aqui.',
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setSending(false);
    }
  };

  const formatBold = (text: string) => {
    return text.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  };

  return (
    <div className="flex flex-col h-full max-h-[600px]">
      {/* Chat header */}
      <div className="bg-[#075e54] rounded-t-xl px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">LocaliZZou</p>
          <p className="text-white/70 text-xs">Online</p>
        </div>
        <Phone className="w-4 h-4 text-white/70" />
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-[#0b141a] px-3 py-4 space-y-2 min-h-[300px]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  msg.sender === 'user'
                    ? 'bg-[#005c4b] text-white rounded-tr-none'
                    : 'bg-[#202c33] text-gray-200 rounded-tl-none'
                }`}
              >
                <div
                  dangerouslySetInnerHTML={{ __html: formatBold(msg.text) }}
                  className="leading-relaxed [&_strong]:font-semibold"
                />
                <p className={`text-[10px] mt-1 text-right ${
                  msg.sender === 'user' ? 'text-white/50' : 'text-gray-500'
                }`}>
                  {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {sending && (
          <div className="flex justify-start">
            <div className="bg-[#202c33] rounded-lg rounded-tl-none px-4 py-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="bg-[#202c33] rounded-b-xl px-3 py-2 flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Digite sua mensagem..."
          className="flex-1 bg-[#2a3942] border-none text-white placeholder:text-gray-500 focus-visible:ring-0 text-sm"
          disabled={sending}
        />
        <Button
          size="icon"
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          className="bg-[#00a884] hover:bg-[#00a884]/80 text-white rounded-full w-9 h-9 shrink-0"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};

export default WhatsAppSimulator;
