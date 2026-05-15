"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/auth";
import { toast } from "react-hot-toast";
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  X,
  Undo2,
  Loader2,
} from "lucide-react";
import type { CarryoverStatus } from "@/types/balanceCarryover";
import { formatCurrency } from "@/utils/format";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface Props {
  customMonth: string;
  customYear: string;
  refreshKey: number;
  onApplied?: () => void;
}

export function CarryoverBanner({ customMonth, customYear, refreshKey, onApplied }: Props) {
  const [status, setStatus] = useState<CarryoverStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const mes = Number(customMonth);
  const ano = Number(customYear);

  // Reset dismissed state when month/year changes
  useEffect(() => {
    setDismissed(false);
  }, [customMonth, customYear]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);
        const res = await apiRequest(
          `/api/balance/carryover/check?mes=${mes}&ano=${ano}`
        );
        if (!res.ok) return;
        const json = await res.json();
        setStatus(json.data ?? json);
      } catch {
        // Silently fail — banner is informational
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, [mes, ano, refreshKey]);

  const handleApply = async () => {
    const toastId = "carryover-apply";
    try {
      setApplying(true);
      toast.loading("Aplicando saldo...", { id: toastId });

      const res = await apiRequest("/api/balance/carryover/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, ano }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || "Erro ao aplicar saldo");

      setStatus(json.data ?? json);

      const label =
        status?.tipo === "positivo"
          ? `Saldo de ${formatCurrency(status?.saldo ?? 0)} adicionado como receita!`
          : `Débito de ${formatCurrency(status?.saldo ?? 0)} adicionado como despesa!`;

      toast.success(label, { id: toastId });
      onApplied?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao aplicar saldo", { id: toastId });
    } finally {
      setApplying(false);
    }
  };

  const handleUndo = async () => {
    const toastId = "carryover-undo";
    try {
      setUndoing(true);
      toast.loading("Desfazendo...", { id: toastId });

      const res = await apiRequest(
        `/api/balance/carryover?mes=${mes}&ano=${ano}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || errJson.message || "Erro ao desfazer");
      }

      // Re-fetch status
      const checkRes = await apiRequest(
        `/api/balance/carryover/check?mes=${mes}&ano=${ano}`
      );
      if (checkRes.ok) {
        const json = await checkRes.json();
        setStatus(json.data ?? json);
      }

      toast.success("Carryover removido!", { id: toastId });
      onApplied?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao desfazer", { id: toastId });
    } finally {
      setUndoing(false);
    }
  };

  // Don't show anything if loading or no meaningful status
  if (loading) return null;
  if (!status || status.status === "sem_saldo" || status.tipo === "zerado") return null;
  if (dismissed) return null;

  const isPositive = status.tipo === "positivo";
  const isAplicado = status.status === "aplicado";

  const srcMonth = MONTH_NAMES[status.source_mes - 1];
  const targetMonth = MONTH_NAMES[mes - 1];
  const saldoFormatted = formatCurrency(Math.abs(status.saldo));

  // Colors
  const accentColor = isPositive ? "text-emerald-400" : "text-red-400";
  const borderColor = isPositive ? "border-emerald-500/30" : "border-red-500/30";
  const bgGlow = isPositive ? "bg-emerald-500/5" : "bg-red-500/5";
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const iconColor = isPositive ? "text-emerald-400" : "text-red-400";
  const btnClass = isPositive
    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
    : "bg-red-600 hover:bg-red-500 text-white";

  if (isAplicado) {
    return (
      <div
        className={`w-full rounded-xl border ${borderColor} ${bgGlow} px-5 py-3 flex items-center justify-between gap-4 text-sm`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-4 h-4 ${iconColor} shrink-0`} />
          <span className="text-[var(--card-text)] opacity-80">
            {isPositive ? "Saldo" : "Débito"} de{" "}
            <span className={`font-semibold ${accentColor}`}>{saldoFormatted}</span>{" "}
            de {srcMonth}/{status.source_ano} aplicado em {targetMonth}/{ano}.
          </span>
        </div>
        <button
          onClick={handleUndo}
          disabled={undoing}
          className="flex items-center gap-1.5 text-xs text-[var(--card-text)] opacity-50 hover:opacity-100 transition-opacity shrink-0"
        >
          {undoing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Undo2 className="w-3.5 h-3.5" />
          )}
          Desfazer
        </button>
      </div>
    );
  }

  // Pendente state — full banner
  return (
    <div
      className={`w-full rounded-xl border ${borderColor} ${bgGlow} px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}
    >
      {/* Left: Icon + message */}
      <div className="flex items-start sm:items-center gap-3">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            isPositive ? "bg-emerald-500/15" : "bg-red-500/15"
          }`}
        >
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-[var(--card-text)]">
            {isPositive ? "Saldo disponível" : "Déficit do mês anterior"}
          </span>
          <span className="text-xs text-[var(--card-text)] opacity-70 mt-0.5">
            {srcMonth}/{status.source_ano} terminou com{" "}
            <span className={`font-semibold ${accentColor}`}>{saldoFormatted}</span>{" "}
            de {isPositive ? "saldo positivo" : "déficit"}.{" "}
            Deseja lançar como {isPositive ? "receita" : "despesa"} em {targetMonth}/{ano}?
          </span>
        </div>
      </div>

      {/* Right: Arrow indicator + actions */}
      <div className="flex items-center gap-2 shrink-0 ml-12 sm:ml-0">
        <div className="hidden sm:flex items-center gap-1 text-xs text-[var(--card-text)] opacity-40">
          <span>{srcMonth}</span>
          <ArrowRight className="w-3 h-3" />
          <span>{targetMonth}</span>
        </div>

        <button
          onClick={handleApply}
          disabled={applying}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${btnClass} disabled:opacity-60`}
        >
          {applying ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Icon className="w-3.5 h-3.5" />
          )}
          {isPositive ? "Adicionar como receita" : "Lançar como despesa"}
        </button>

        <button
          onClick={() => setDismissed(true)}
          className="p-1.5 rounded-lg text-[var(--card-text)] opacity-40 hover:opacity-80 transition-opacity"
          title="Ignorar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
