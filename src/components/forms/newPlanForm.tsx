"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textArea";
import { toast } from "react-hot-toast";
import { apiRequest } from "@/lib/auth";
import { DatePicker } from "@/components/ui/datePicker";
import { formatCurrency } from "@/utils/format";
import {
  getApiErrorMessage,
  getContextualErrorMessage,
  generateToastId,
} from "@/utils/errorUtils";

interface Props {
  onClose: () => void;
  onCreated?: () => void;
}

interface Simulacao {
  aporte_mensal: number;
  taxa_utilizada: number;
  taxa_fonte: "custom" | "selic" | "fallback";
  meses_restantes: number;
}

export function NewPlanForm({ onClose, onCreated }: Props) {
  const [nome, setNome] = useState("");
  const [meta, setMeta] = useState("");
  const [prazo, setPrazo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [taxaAnual, setTaxaAnual] = useState("");

  const [simulacao, setSimulacao] = useState<Simulacao | null>(null);
  const [simulando, setSimulando] = useState(false);

  // Simulador ao vivo: recalcula o aporte mensal conforme meta/prazo/taxa mudam.
  useEffect(() => {
    const metaNum = parseFloat(meta);
    if (!meta || isNaN(metaNum) || metaNum <= 0 || !prazo) {
      setSimulacao(null);
      return;
    }

    const taxaNum = taxaAnual ? parseFloat(taxaAnual) : undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setSimulando(true);
        const res = await apiRequest("/api/plans/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meta: metaNum,
            prazo,
            taxa_anual: taxaNum && taxaNum > 0 ? taxaNum : undefined,
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          setSimulacao(null);
          return;
        }
        const data = await res.json();
        setSimulacao(data.data ?? null);
      } catch {
        // Ignora erros de simulação (ex.: requisição abortada)
      } finally {
        setSimulando(false);
      }
    }, 450);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [meta, prazo, taxaAnual]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const toastId = generateToastId("save", "plan");

    if (!nome || !meta || !prazo) {
      toast.error("Os campos Nome, Meta e Prazo são obrigatórios", {
        id: toastId,
      });
      return;
    }

    if (isNaN(parseFloat(meta)) || parseFloat(meta) <= 0) {
      toast.error("A meta deve ser um valor positivo", { id: toastId });
      return;
    }

    const taxaNum = taxaAnual ? parseFloat(taxaAnual) : undefined;
    if (taxaAnual && (isNaN(taxaNum!) || taxaNum! <= 0)) {
      toast.error("A taxa anual deve ser um valor positivo", { id: toastId });
      return;
    }

    try {
      toast.loading("Salvando plano...", { id: toastId });

      const res = await apiRequest("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          meta: parseFloat(meta),
          prazo,
          descricao,
          taxa_anual: taxaNum && taxaNum > 0 ? taxaNum : undefined,
        }),
      });

      if (!res.ok) {
        const errorMessage = await getApiErrorMessage(
          res,
          "Erro ao salvar plano. Verifique os dados informados"
        );
        toast.error(errorMessage, { id: toastId });
        return;
      }

      toast.success("Plano cadastrado com sucesso!", { id: toastId });
      onCreated?.();
      onClose();
    } catch (error) {
      const errorMessage = getContextualErrorMessage(error, "save", "plano");
      toast.error(errorMessage, { id: toastId });
    }
  };

  const fonteLabel =
    simulacao?.taxa_fonte === "custom"
      ? "taxa personalizada"
      : simulacao?.taxa_fonte === "selic"
        ? "Selic ao vivo"
        : "taxa estimada";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Nome do Plano *</Label>
        <Input
          placeholder="Ex: Viagem para Europa, Comprar carro..."
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      </div>

      <div>
        <Label>Meta (R$) *</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="Ex: 10000.00"
          value={meta}
          onChange={(e) => setMeta(e.target.value)}
        />
      </div>

      <div>
        <Label>Prazo *</Label>
        <DatePicker
          value={prazo}
          onChange={setPrazo}
          placeholder="Selecione a data"
        />
      </div>

      <div>
        <Label>Taxa anual personalizada (% a.a.) — opcional</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="Deixe em branco para usar a Selic ao vivo"
          value={taxaAnual}
          onChange={(e) => setTaxaAnual(e.target.value)}
        />
      </div>

      {/* Simulador ao vivo do aporte mensal */}
      {simulacao && (
        <div className="rounded-lg border border-cyan-600/40 bg-cyan-600/10 p-3">
          <p className="text-xs text-[var(--card-text)]/70">
            Para atingir a meta no prazo, invista cerca de:
          </p>
          <p className="text-2xl font-bold text-cyan-500">
            {formatCurrency(simulacao.aporte_mensal)}
            <span className="text-sm font-normal text-[var(--card-text)]/70">
              {" "}
              / mês
            </span>
          </p>
          <p className="text-[11px] text-[var(--card-text)]/60">
            {simulacao.taxa_utilizada.toFixed(2)}% a.a. ({fonteLabel}) ·{" "}
            {simulacao.meses_restantes}{" "}
            {simulacao.meses_restantes === 1 ? "mês" : "meses"} · juros compostos
          </p>
        </div>
      )}
      {simulando && !simulacao && (
        <p className="text-xs text-[var(--card-text)]/50">Calculando aporte...</p>
      )}

      <div>
        <Label>Descrição</Label>
        <Textarea
          placeholder="Descreva mais detalhes sobre este plano..."
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-md bg-[#1F2937] text-white hover:bg-[#374151] transition"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 rounded-md bg-cyan-600 text-white hover:bg-cyan-500 transition"
        >
          Salvar Plano
        </button>
      </div>
    </form>
  );
}
