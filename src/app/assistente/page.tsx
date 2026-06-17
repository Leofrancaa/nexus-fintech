"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles } from "lucide-react";
import PageTitle from "@/components/pageTitle";
import { apiRequest, isAuthenticated } from "@/lib/auth";
import { toast } from "react-hot-toast";

interface Message {
  id?: number;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Qual foi meu maior gasto este mês?",
  "Como está meu saldo do mês?",
  "Em quais categorias eu mais gastei?",
  "Como estão meus planos de investimento?",
];

// Deve casar com MAX_MESSAGE_LENGTH no chatService (servidor).
const MAX_LEN = 500;

export default function AssistantPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [remaining, setRemaining] = useState<number>(4);
  const [limit, setLimit] = useState<number>(4);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated()) router.push("/login");
  }, [router]);

  const fetchChat = useCallback(async () => {
    try {
      const res = await apiRequest("/api/chat");
      if (res.ok) {
        const data = await res.json();
        setMessages(data.data?.messages ?? []);
        setRemaining(data.data?.status?.remaining ?? 4);
        setLimit(data.data?.status?.limit ?? 4);
      }
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    fetchChat();
  }, [fetchChat]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    if (remaining <= 0) {
      toast.error("Você atingiu o limite de mensagens de hoje.");
      return;
    }

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setSending(true);
    try {
      const res = await apiRequest("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Erro ao falar com o assistente.");
        setMessages((prev) => prev.slice(0, -1)); // remove a mensagem otimista
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.data.reply }]);
      setRemaining(data.data.status.remaining);
    } catch {
      toast.error("Erro ao enviar mensagem.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  return (
    <main
      className="flex flex-col min-h-screen px-8 py-8 lg:py-4"
      style={{ background: "var(--page-bg)" }}
    >
      <div className="flex flex-col lg:flex-row lg:justify-between gap-2 mt-14 lg:mt-0">
        <PageTitle
          title="Assistente"
          subTitle="Pergunte sobre suas finanças (IA)"
        />
        <span className="self-start text-sm px-3 py-1 rounded-full bg-cyan-600/15 text-cyan-500 font-medium">
          {remaining}/{limit} mensagens hoje
        </span>
      </div>

      <div
        className="mt-6 flex-1 flex flex-col rounded-xl border overflow-hidden"
        style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
      >
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[50vh]">
          {messages.length === 0 && (
            <div className="text-center text-[var(--plan-card-text)] mt-10">
              <Sparkles className="w-8 h-8 mx-auto text-cyan-500 mb-2" />
              <p>Pergunte algo sobre suas finanças para começar.</p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={remaining <= 0 || sending}
                    className="text-xs px-3 py-2 rounded-full border hover:bg-[var(--hover-bg)] disabled:opacity-50"
                    style={{ borderColor: "var(--card-border)", color: "var(--card-text)" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={m.id ?? i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-cyan-600 text-white rounded-br-sm"
                    : "rounded-bl-sm"
                }`}
                style={
                  m.role === "assistant"
                    ? { backgroundColor: "var(--progress-bg)", color: "var(--card-text)" }
                    : undefined
                }
              >
                {m.content}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div
                className="rounded-2xl rounded-bl-sm px-4 py-2 text-sm animate-pulse"
                style={{ backgroundColor: "var(--progress-bg)", color: "var(--card-text)" }}
              >
                Pensando...
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-start gap-2 p-3 border-t"
          style={{ borderColor: "var(--card-border)" }}
        >
          <div className="flex-1">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_LEN))}
              maxLength={MAX_LEN}
              placeholder={remaining > 0 ? "Digite sua pergunta..." : "Limite diário atingido"}
              disabled={remaining <= 0 || sending}
              className="w-full rounded-lg px-3 py-2 bg-[var(--page-bg)] border outline-none disabled:opacity-50"
              style={{ borderColor: "var(--card-border)", color: "var(--card-text)" }}
            />
            <div
              className={`text-[10px] text-right mt-1 ${
                input.length >= MAX_LEN ? "text-red-400" : "text-[var(--plan-card-text)]"
              }`}
            >
              {input.length}/{MAX_LEN}
            </div>
          </div>
          <button
            type="submit"
            disabled={remaining <= 0 || sending || !input.trim()}
            className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 flex items-center gap-1"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </main>
  );
}
