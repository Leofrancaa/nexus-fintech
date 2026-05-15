"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { formatCurrency } from "@/utils/format";
import EditButton from "@/components/ui/editButton";
import DeleteButton from "@/components/ui/deleteButton";
import { ContributeModal } from "../modals/contributeModal";
import { EditPlanModal } from "../modals/editPlanModal";
import ConfirmDialog from "@/components/ui/confirmDialog";
import { apiRequest } from "@/lib/auth";
import { useRouter } from "next/navigation";

interface Plano {
  id: number;
  nome: string;
  descricao?: string;
  meta: number;
  total_contribuido: number;
  prazo: string;
}

interface PlanCardProps {
  plano: Plano;
  onRefresh?: () => void;
}

export default function PlanCard({ plano, onRefresh }: PlanCardProps) {
  const [editando, setEditando] = useState<Plano | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const router = useRouter();

  const progresso = (plano.total_contribuido / plano.meta) * 100;
  const restante = plano.meta - plano.total_contribuido;

  const getStatus = () => {
    if (progresso >= 100) return "Concluído";
    if (progresso >= 70) return "Quase lá";
    if (progresso >= 30) return "Em progresso";
    return "Iniciando";
  };

  const getStatusColor = () => {
    if (progresso >= 100) return "#059669";
    if (progresso >= 70) return "#f59e0b";
    if (progresso >= 30) return "#3b82f6";
    return "#6b7280";
  };

  const getProgressBarColor = () => {
    if (progresso >= 100) return "#10b981";
    if (progresso >= 70) return "#f59e0b";
    if (progresso >= 30) return "#3b82f6";
    return "#6b7280";
  };

  const handleDelete = async () => {
    try {
      const res = await apiRequest(`/api/plans/${plano.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || data?.message || "Erro ao excluir plano.");
        return;
      }

      toast.success("Plano excluído com sucesso!");
      onRefresh?.();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessão expirada")) {
        router.push("/login");
      } else {
        toast.error("Erro ao excluir plano.");
      }
    }
  };

  return (
    <>
      <div
        className="rounded-xl border p-5 shadow-lg space-y-2 relative"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
          color: "var(--card-text)",
        }}
      >
        {/* Nome e status */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-semibold">{plano.nome}</h3>
            {plano.descricao && (
              <p className="text-sm text-[var(--plan-card-text)]">
                {plano.descricao}
              </p>
            )}
          </div>

          <span
            className="text-xs px-3 py-1 rounded-full font-medium"
            style={{ backgroundColor: getStatusColor(), color: "#fff" }}
          >
            {getStatus()}
          </span>
        </div>

        {/* Barra de progresso */}
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Progresso
          </p>
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: "var(--progress-bg)" }}
          >
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${Math.min(progresso, 100)}%`,
                backgroundColor: getProgressBarColor(),
              }}
            />
          </div>

          <p className="text-sm mt-1 text-right font-bold text-[var(--card-text)]">
            {progresso.toFixed(1)}%
          </p>
        </div>

        {/* Valores */}
        <div className="grid grid-cols-2 gap-4 text-md">
          <div>
            <p className="text-[var(--plan-card-text)]">Atual</p>
            <p className="text-green-400 font-medium">
              {formatCurrency(plano.total_contribuido)}
            </p>
          </div>

          <div>
            <p className="text-[var(--plan-card-text)]">Meta</p>
            <p className="font-medium text-[var(--card-text)]">
              {formatCurrency(plano.meta)}
            </p>
          </div>

          <div>
            <p className="text-[var(--plan-card-text)]">Restante</p>
            <p className="text-red-400 font-medium">
              {formatCurrency(restante)}
            </p>
          </div>

          <div>
            <p className="text-[var(--plan-card-text)]">Prazo</p>
            <p className="font-medium text-[var(--card-text)]">
              {new Date(plano.prazo).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>

        {/* Ações */}
        <div
          className="flex justify-between items-center pt-3 border-t"
          style={{ borderColor: "var(--card-border)" }}
        >
          <ContributeModal planId={plano.id} onContributed={onRefresh} />

          <div className="flex items-center gap-2">
            <EditButton onClick={() => setEditando(plano)} />
            <>
              <DeleteButton onClick={() => setConfirmOpen(true)} />
              <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Excluir plano"
                description="Tem certeza que deseja excluir este plano? Essa ação não poderá ser desfeita."
                onCancel={() => setConfirmOpen(false)}
                onConfirm={handleDelete}
              />
            </>
          </div>
        </div>
      </div>

      {/* Modal de edição */}
      {editando && (
        <EditPlanModal
          plano={editando}
          onClose={() => setEditando(null)}
          onUpdated={onRefresh}
        />
      )}
    </>
  );
}
