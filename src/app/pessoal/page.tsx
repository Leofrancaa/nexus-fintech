"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import PageTitle from "@/components/pageTitle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textArea";
import { DatePicker } from "@/components/ui/datePicker";
import ConfirmDialog from "@/components/ui/confirmDialog";
import {
  StatusSelect,
  MilestoneStatus,
} from "@/components/shared/statusSelect";
import { apiRequest, isAuthenticated } from "@/lib/auth";
import { toast } from "react-hot-toast";

interface Goal {
  id: number;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  target_date: string | null;
}

export default function PersonalPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDate, setNewDate] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) router.push("/login");
  }, [router]);

  const fetchGoals = useCallback(async () => {
    try {
      const res = await apiRequest("/api/personal");
      if (res.ok) {
        const data = await res.json();
        setGoals(data.data ?? []);
      }
    } catch {
      toast.error("Erro ao carregar metas pessoais");
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const changeStatus = async (id: number, status: MilestoneStatus) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, status } : g)));
    const res = await apiRequest(`/api/personal/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast.error("Erro ao atualizar status");
      fetchGoals();
    }
  };

  const addGoal = async () => {
    if (!newTitle.trim()) {
      toast.error("Informe um título");
      return;
    }
    const res = await apiRequest("/api/personal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle,
        description: newDesc,
        target_date: newDate || null,
      }),
    });
    if (!res.ok) {
      toast.error("Erro ao adicionar meta");
      return;
    }
    toast.success("Meta adicionada!");
    setNewTitle("");
    setNewDesc("");
    setNewDate("");
    setAdding(false);
    fetchGoals();
  };

  const deleteGoal = async (id: number) => {
    const res = await apiRequest(`/api/personal/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Erro ao remover meta");
      return;
    }
    toast.success("Meta removida!");
    fetchGoals();
  };

  return (
    <main
      className="flex flex-col min-h-screen px-8 py-8 lg:py-4"
      style={{ background: "var(--page-bg)" }}
    >
      <div className="flex flex-col lg:flex-row lg:justify-between gap-4 mt-14 lg:mt-0">
        <PageTitle
          title="Pessoal"
          subTitle="Suas metas de vida (casa, viagem, etc.)"
        />
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 self-start px-4 py-2 rounded-md bg-cyan-600 text-white hover:bg-cyan-500"
        >
          <Plus className="w-4 h-4" /> Nova meta
        </button>
      </div>

      {adding && (
        <div
          className="mt-6 rounded-xl border p-4 space-y-3"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
          }}
        >
          <div>
            <Label>Título *</Label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ex: Comprar casa, Viagem ao Japão..."
            />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          </div>
          <div>
            <Label>Data-alvo (opcional)</Label>
            <DatePicker
              value={newDate}
              onChange={setNewDate}
              placeholder="Selecione a data"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setAdding(false)}
              className="px-4 py-2 rounded-md bg-[#1F2937] text-white hover:bg-[#374151]"
            >
              Cancelar
            </button>
            <button
              onClick={addGoal}
              className="px-4 py-2 rounded-md bg-cyan-600 text-white hover:bg-cyan-500"
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      <section className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {goals.length === 0 ? (
          <p className="text-[var(--card-text)]/60">
            Nenhuma meta pessoal cadastrada.
          </p>
        ) : (
          goals.map((g) => (
            <div
              key={g.id}
              className="rounded-xl border p-4 shadow-sm"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--card-border)",
                color: "var(--card-text)",
              }}
            >
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-semibold">{g.title}</h3>
                <StatusSelect
                  value={g.status}
                  onChange={(s) => changeStatus(g.id, s)}
                />
              </div>
              {g.description && (
                <p className="text-sm text-[var(--plan-card-text)] mt-1">
                  {g.description}
                </p>
              )}
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs text-[var(--plan-card-text)]">
                  {g.target_date
                    ? new Date(`${g.target_date}T12:00:00`).toLocaleDateString(
                        "pt-BR"
                      )
                    : "Sem data-alvo"}
                </span>
                <button
                  onClick={() => setConfirmId(g.id)}
                  className="text-red-400 hover:text-red-500"
                  aria-label="Remover meta"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(open) => !open && setConfirmId(null)}
        title="Remover meta"
        description="Tem certeza que deseja remover esta meta pessoal?"
        onCancel={() => setConfirmId(null)}
        onConfirm={() => {
          if (confirmId !== null) deleteGoal(confirmId);
          setConfirmId(null);
        }}
      />
    </main>
  );
}
