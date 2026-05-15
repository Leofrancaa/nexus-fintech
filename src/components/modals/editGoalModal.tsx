"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { apiRequest } from "@/lib/auth";
import { toast } from "react-hot-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

interface Goal {
  id: number;
  nome: string;
  valor_alvo: number;
  mes: number;
  ano: number;
}

interface EditGoalModalProps {
  goal: Goal | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export function EditGoalModal({
  goal,
  onClose,
  onUpdated,
}: EditGoalModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: goal?.nome || "",
    valor_alvo: String(goal?.valor_alvo || ""),
    mes: String(goal?.mes || ""),
    ano: String(goal?.ano || ""),
  });

  if (!goal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        nome: formData.nome,
        valor_alvo: Number(formData.valor_alvo),
        mes: Number(formData.mes),
        ano: Number(formData.ano),
      };

      const res = await apiRequest(`/api/goals/${goal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.message || "Erro ao atualizar meta");
      }

      toast.success("Meta atualizada com sucesso!");
      onClose();
      onUpdated?.();
    } catch (error) {
      toast.error((error as Error).message || "Erro ao atualizar meta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={true} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#111] border border-[#333] p-6 shadow-lg focus:outline-none max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-xl font-semibold text-white">
              Editar Meta
            </Dialog.Title>

            <Dialog.Close asChild>
              <button
                className="text-white hover:text-gray-300 cursor-pointer"
                data-radix-dialog-close
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nome da Meta</Label>
              <Input
                type="text"
                required
                value={formData.nome}
                onChange={(e) =>
                  setFormData({ ...formData, nome: e.target.value })
                }
                placeholder="Ex: Meta de Receita de Janeiro"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Valor Alvo de Receita (R$)</Label>
              <Input
                type="number"
                step="0.01"
                required
                value={formData.valor_alvo}
                onChange={(e) =>
                  setFormData({ ...formData, valor_alvo: e.target.value })
                }
                placeholder="0.00"
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">
                Total de receitas que você deseja atingir no mês
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Mês</Label>
                <Select
                  value={formData.mes}
                  onValueChange={(value) =>
                    setFormData({ ...formData, mes: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={m.toString()}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Ano</Label>
                <Select
                  value={formData.ano}
                  onValueChange={(value) =>
                    setFormData({ ...formData, ano: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026].map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="flex-1 px-4 py-2 border border-[var(--card-border)] rounded-lg hover:bg-[var(--filter-input-bg)] transition-colors text-[var(--card-text)]"
                >
                  Cancelar
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? "Atualizando..." : "Atualizar Meta"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
