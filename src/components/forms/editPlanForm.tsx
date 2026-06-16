"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textArea";
import { toast } from "react-hot-toast";
import { apiRequest } from "@/lib/auth";
import { DatePicker } from "@/components/ui/datePicker";

interface Plano {
  id: number;
  nome: string;
  meta: number;
  prazo: string;
  descricao?: string;
  taxa_anual?: number | null;
}

interface Props {
  plano: Plano;
  onClose: () => void;
  onUpdated?: () => void;
}

export function EditPlanForm({ plano, onClose, onUpdated }: Props) {
  const [nome, setNome] = useState(plano.nome);
  const [meta, setMeta] = useState(plano.meta.toString());
  const [prazo, setPrazo] = useState(plano.prazo);
  const [descricao, setDescricao] = useState(plano.descricao || "");
  const [taxaAnual, setTaxaAnual] = useState(
    plano.taxa_anual != null ? String(plano.taxa_anual) : ""
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome || !meta || !prazo) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    const taxaNum = taxaAnual ? parseFloat(taxaAnual) : null;
    if (taxaAnual && (isNaN(taxaNum!) || taxaNum! <= 0)) {
      toast.error("A taxa anual deve ser um valor positivo.");
      return;
    }

    try {
      const res = await apiRequest(`/api/plans/${plano.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          meta: parseFloat(meta),
          prazo,
          descricao,
          taxa_anual: taxaNum && taxaNum > 0 ? taxaNum : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Erro ao atualizar plano.");
        return;
      }

      toast.success("Plano atualizado!");
      onUpdated?.();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao atualizar plano."
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-white">
      {/* Nome + Meta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Nome do Plano</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>

        <div>
          <Label>Meta (R$)</Label>
          <Input
            type="number"
            value={meta}
            onChange={(e) => setMeta(e.target.value)}
          />
        </div>
      </div>

      {/* Prazo */}
      <div>
        <Label>Prazo</Label>
        <DatePicker
          value={prazo}
          onChange={setPrazo}
          placeholder="Selecione a data"
        />
      </div>

      {/* Taxa anual personalizada */}
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

      {/* Descrição */}
      <div>
        <Label>Descrição (opcional)</Label>
        <Textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </div>

      {/* Botões */}
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
          className="px-6 py-3 w-full rounded-xl text-white font-semibold text-[16px] bg-blue-600 hover:opacity-80 transition-all"
        >
          Salvar alterações
        </button>
      </div>
    </form>
  );
}
