"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";
import { Categoria } from "@/types/category";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/auth";
import {
  getApiErrorMessage,
  getContextualErrorMessage,
  generateToastId,
} from "@/utils/errorUtils";

const cores = [
  // Azuis
  "#3b82f6", // Azul
  "#60a5fa", // Azul Claro
  "#1e40af", // Azul Escuro
  "#0ea5e9", // Sky Blue
  "#06b6d4", // Ciano

  // Roxos e Rosas
  "#6366f1", // Índigo
  "#8b5cf6", // Roxo
  "#a855f7", // Roxo Claro
  "#ec4899", // Rosa
  "#f43f5e", // Rosa Vermelho

  // Verdes
  "#10b981", // Verde
  "#22c55e", // Verde Claro
  "#14b8a6", // Teal
  "#84cc16", // Lima
  "#16a34a", // Verde Escuro

  // Amarelos e Laranjas
  "#f59e0b", // Âmbar
  "#eab308", // Amarelo
  "#fbbf24", // Amarelo Claro
  "#f97316", // Laranja
  "#fb923c", // Laranja Claro

  // Vermelhos
  "#ef4444", // Vermelho
  "#dc2626", // Vermelho Escuro
  "#f87171", // Vermelho Claro

  // Neutros
  "#64748b", // Slate
  "#78716c", // Stone
  "#71717a", // Zinc
  "#6b7280", // Gray
];

interface NewCategoryFormProps {
  onClose: () => void;
  onCreated?: (categoria: Categoria) => void;
  defaultTipo?: "despesa" | "receita";
}

export function NewCategoryForm({ onClose, onCreated, defaultTipo }: NewCategoryFormProps) {
  const [nome, setNome] = useState("");
  const [corSelecionada, setCorSelecionada] = useState("");
  const [tipo, setTipo] = useState<"despesa" | "receita">(defaultTipo ?? "despesa");
  const [parentId, setParentId] = useState<number | null>(null);
  const [categoriasPai, setCategoriasPai] = useState<Categoria[]>([]);

  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const res = await apiRequest("/api/categories");

        if (!res.ok) {
          toast.error("Não foi possível carregar as categorias existentes", {
            id: "load-parent-categories",
          });
          return;
        }
        const response = await res.json();
        console.log('[newCategoryForm] Categories response:', response);

        // Handle both direct array and wrapped response formats
        const data: Categoria[] = response.data || response;
        setCategoriasPai(data.filter((cat) => !cat.parent_id));
      } catch (error) {
        console.log('[newCategoryForm] Error fetching categories:', error);
        toast.error("Não foi possível conectar ao servidor. Verifique sua internet", {
          id: "load-parent-categories",
        });
      }
    };

    fetchCategorias();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Criar ID único para evitar toasts duplicados
    const toastId = generateToastId("save", "category");

    // Validação dos campos obrigatórios
    if (!nome || !corSelecionada || !tipo) {
      toast.error("Os campos Nome, Cor e Tipo são obrigatórios", {
        id: toastId,
      });
      return;
    }

    try {
      toast.loading("Salvando categoria...", { id: toastId });

      const res = await apiRequest("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome,
          cor: corSelecionada,
          tipo,
          parent_id: parentId,
        }),
      });

      if (!res.ok) {
        const errorMessage = await getApiErrorMessage(
          res,
          "Erro ao criar categoria. Verifique se o nome não está em uso"
        );
        toast.error(errorMessage, { id: toastId });
        return;
      }

      const response = await res.json();
      const novaCategoria: Categoria = response.data || response;
      toast.success("Categoria criada com sucesso!", { id: toastId });
      onCreated?.(novaCategoria);
      onClose();
    } catch (error) {
      const errorMessage = getContextualErrorMessage(
        error,
        "save",
        "categoria"
      );
      toast.error(errorMessage, { id: toastId });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nome */}
      <div>
        <Label>Nome da Categoria *</Label>
        <Input
          placeholder="Ex: Alimentação, Transporte..."
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="mt-1"
        />
      </div>

      {/* Cor */}
      <div>
        <Label>Cor da Categoria *</Label>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {cores.map((cor) => (
            <button
              key={cor}
              type="button"
              className={`h-8 rounded-md border-2 transition-all cursor-pointer ${
                corSelecionada === cor
                  ? "border-white ring-2 ring-offset-2 ring-[#00D4D4]"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: cor }}
              onClick={() => setCorSelecionada(cor)}
            />
          ))}
        </div>
      </div>

      {/* Tipo */}
      <div>
        <Label>Tipo *</Label>
        <div className="flex gap-4 mt-2">
          {["despesa", "receita"].map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setTipo(t as "despesa" | "receita")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition cursor-pointer ${
                tipo === t
                  ? "bg-[#2256FF] text-white"
                  : "bg-[#1B1B1B] text-white border border-[#2e2e2e]"
              }`}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Categoria Pai */}
      <div>
        <Label>Categoria Pai (opcional)</Label>
        <Select
          value={parentId?.toString() ?? ""}
          onValueChange={(value) =>
            setParentId(value === "" ? null : Number(value))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Sem categoria pai" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="none">Sem categoria pai</SelectItem>
            {categoriasPai.map((cat) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                {cat.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Botões */}
      <div className="flex justify-end gap-2 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-3 w-full rounded-xl font-medium text-white bg-[#1F2937] hover:bg-[#374151] transition-all cursor-pointer"
        >
          Cancelar
        </button>

        <button
          type="submit"
          className="px-6 py-3 w-full rounded-xl text-white font-semibold text-[16px] bg-[#00D4D4] cursor-pointer hover:opacity-80 hover:text-black transition-all"
        >
          Salvar
        </button>
      </div>
    </form>
  );
}
