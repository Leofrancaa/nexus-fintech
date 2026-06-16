"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";
import { apiRequest } from "@/lib/auth";
import {
  getApiErrorMessage,
  getContextualErrorMessage,
  generateToastId,
} from "@/utils/errorUtils";

interface Props {
  planId: number;
  onClose: () => void;
  onContributed?: () => void;
}

export function ContributeForm({ planId, onClose, onContributed }: Props) {
  const [valor, setValor] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Criar ID único para evitar toasts duplicados
    const toastId = generateToastId("save", "contribution", planId);

    const parsedValor = parseFloat(valor);

    if (!valor || isNaN(parsedValor) || parsedValor <= 0) {
      toast.error("Informe um valor válido para a contribuição", {
        id: toastId,
      });
      return;
    }

    try {
      toast.loading("Adicionando contribuição...", { id: toastId });

      const res = await apiRequest(`/api/plans/${planId}/contribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: parsedValor }),
      });

      if (!res.ok) {
        const errorMessage = await getApiErrorMessage(
          res,
          "Erro ao adicionar contribuição. Verifique o valor informado"
        );
        toast.error(errorMessage, { id: toastId });
        return;
      }

      // A resposta traz o aporte mensal recalculado após a contribuição.
      const payload = await res.json().catch(() => null);
      const novoAporte = payload?.data?.aporte_mensal_necessario as
        | number
        | undefined;
      const status = payload?.data?.status as string | undefined;

      const baseMsg = `Contribuição de R$ ${parsedValor.toFixed(2)} adicionada!`;
      const extra =
        status === "Concluído"
          ? " 🎉 Meta concluída!"
          : novoAporte !== undefined
            ? ` Novo aporte mensal: R$ ${novoAporte.toFixed(2)}`
            : "";

      toast.success(baseMsg + extra, { id: toastId });
      onContributed?.();
      onClose();
    } catch (error) {
      const errorMessage = getContextualErrorMessage(
        error,
        "save",
        "contribuição"
      );
      toast.error(errorMessage, { id: toastId });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-white">
      <div>
        <Label>Valor da contribuição (R$) *</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="Ex: 200.00"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-3 w-full rounded-xl font-medium text-white bg-[#1F2937] hover:bg-[#374151] transition-all"
        >
          Cancelar
        </button>

        <button
          type="submit"
          className="px-6 py-3 w-full rounded-xl text-white font-semibold text-[16px] bg-green-600 hover:opacity-80 hover:text-black transition-all"
        >
          Contribuir
        </button>
      </div>
    </form>
  );
}
