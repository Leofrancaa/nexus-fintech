"use client";

import { useEffect, useState } from "react";
import EditButton from "../ui/editButton";
import DeleteButton from "../ui/deleteButton";
import ConfirmDialog from "../ui/confirmDialog";
import { toast } from "react-hot-toast";
import { EditExpenseModal } from "../modals/editExpenseModal";
import { apiRequest } from "@/lib/auth";
import { formatDateBR } from "@/lib/utils";

interface Expense {
  id: number;
  tipo: string;
  quantidade: number;
  metodo_pagamento: string;
  data: string;
  categoria_nome?: string;
  cor_categoria?: string;
  category_id?: number;
  fixo?: boolean;
  observacoes?: string;
}

interface ExpenseListProps {
  refreshKey: number;
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>;
  searchTerm: string;
  categoryId: string;
  period: string;
  customMonth?: string;
  customYear?: string;
}

export function ExpenseList({
  refreshKey,
  setRefreshKey,
  searchTerm,
  categoryId,
  period,
  customMonth,
  customYear,
}: ExpenseListProps) {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<number | null>(
    null
  );
  const [editExpense, setEditExpense] = useState<Expense | null>(null);

  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        let startDate = "";
        let endDate = "";

        const pad = (n: number) => String(n).padStart(2, "0");

        if (period === "custom" && customMonth && customYear) {
          const mes = parseInt(customMonth);
          const ano = parseInt(customYear);
          startDate = `${ano}-${pad(mes)}-01`;
          endDate = new Date(ano, mes, 0).toISOString().split("T")[0];
        } else {
          const now = new Date();
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

          switch (period) {
            case "mes_passado":
              startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                .toISOString()
                .split("T")[0];
              endDate = new Date(now.getFullYear(), now.getMonth(), 0)
                .toISOString()
                .split("T")[0];
              break;
            case "ultimos_3_meses":
              startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1)
                .toISOString()
                .split("T")[0];
              endDate = lastDay.toISOString().split("T")[0];
              break;
            case "ano_atual":
              startDate = `${now.getFullYear()}-01-01`;
              endDate = `${now.getFullYear()}-12-31`;
              break;
            case "mes_atual":
            default:
              startDate = firstDay.toISOString().split("T")[0];
              endDate = lastDay.toISOString().split("T")[0];
          }
        }

        const res = await apiRequest(
          `/api/expenses?start_date=${startDate}&end_date=${endDate}`
        );

        const data = await res.json();
        let filtrado = (data.data || []) as Expense[];

        if (categoryId !== "todas") {
          filtrado = filtrado.filter(
            (e) => String(e.category_id) === categoryId
          );
        }

        if (searchTerm.trim() !== "") {
          filtrado = filtrado.filter((e) =>
            e.tipo.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }

        setExpenses(filtrado);
      } catch (error) {
        console.error("Erro ao carregar despesas:", error);
        setExpenses([]);
      }
    };

    fetchExpenses();
  }, [refreshKey, searchTerm, categoryId, period, customMonth, customYear]);

  const handleDelete = async (id: number) => {
    const toastId = toast.loading("Excluindo despesa...");

    try {
      const res = await apiRequest(`/api/expenses/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Erro ao excluir despesa.");
      }

      const { data: deletedData } = await res.json();

      const idsRemovidos = Array.isArray(deletedData)
        ? deletedData.map((d: Expense) => d.id)
        : [deletedData.id];

      setExpenses(
        (prev) => prev?.filter((e) => !idsRemovidos.includes(e.id)) || []
      );

      setRefreshKey((prev) => prev + 1);
      toast.success("Despesa excluída com sucesso!", { id: toastId });
    } catch (err: unknown) {
      console.error(err);
      const errorMessage =
        err instanceof Error ? err.message : "Erro ao excluir despesa.";
      toast.error(errorMessage, { id: toastId });
    }
  };

  return (
    <div className="bg-[var(--list-bg)] border border-[var(--card-border)] rounded-2xl p-6 w-full lg:max-w-[80%] text-[var(--card-text)]">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[var(--card-text)]">
          Despesas Recentes
        </h2>
        <p className="text-base text-muted-foreground">
          Últimas movimentações registradas
        </p>
      </div>

      <div className="space-y-5">
        {expenses && expenses.length > 0 ? (
          expenses.map((expense) => (
            <div
              key={expense.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl p-5 border transition-all
    bg-[var(--card-list-bg)] border-[var(--card-border)] hover:border-[#00D4D4]"
            >
              <div className="flex flex-col flex-1 break-words">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
                  <p className="text-lg font-bold flex items-center gap-2">
                    {expense.tipo}
                    {expense.fixo && (
                      <span className="text-xs font-semibold text-yellow-400 bg-yellow-900/30 px-2 py-0.5 rounded-full">
                        Fixo
                      </span>
                    )}
                  </p>
                </div>

                <div className="text-sm lg:text-md text-muted-foreground mt-2 flex flex-wrap gap-2 items-center">
                  {expense.categoria_nome ? (
                    <span className="font-medium">
                      {expense.categoria_nome}
                    </span>
                  ) : (
                    <span className="text-red-400">Sem categoria</span>
                  )}
                  <span>•</span>
                  <span className="font-medium">
                    {expense.metodo_pagamento}
                  </span>
                  <span>•</span>
                  <span className="font-medium">
                    {formatDateBR(expense.data)}
                  </span>
                  {expense.observacoes && (
                    <>
                      <span>•</span>
                      <span className="text-muted-foreground truncate max-w-[180px]">
                        Obs: {expense.observacoes}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-between sm:justify-end items-center gap-4 w-full sm:w-auto">
                <p className="text-red-500 font-bold text-lg whitespace-nowrap">
                  -
                  {expense.quantidade.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>

                <div className="flex gap-2">
                  {expense.metodo_pagamento !== "cartao de credito" && (
                    <EditButton onClick={() => setEditExpense(expense)} />
                  )}
                  <DeleteButton
                    onClick={() => {
                      setSelectedExpenseId(expense.id);
                      setConfirmOpen(true);
                    }}
                  />
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-base text-muted-foreground mt-2">
            Nenhuma despesa encontrada para o filtro atual.
          </p>
        )}
      </div>

      {selectedExpenseId !== null && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          onCancel={() => setSelectedExpenseId(null)}
          onConfirm={() => {
            if (selectedExpenseId !== null) {
              handleDelete(selectedExpenseId);
              setSelectedExpenseId(null);
            }
          }}
        />
      )}

      {editExpense && (
        <EditExpenseModal
          expense={editExpense}
          onClose={() => setEditExpense(null)}
          onUpdated={() => {
            setEditExpense(null);
            setRefreshKey((prev) => prev + 1);
          }}
        />
      )}
    </div>
  );
}
