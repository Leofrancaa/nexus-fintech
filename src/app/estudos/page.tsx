"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import PageTitle from "@/components/pageTitle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textArea";
import ConfirmDialog from "@/components/ui/confirmDialog";
import { apiRequest, isAuthenticated } from "@/lib/auth";
import { toast } from "react-hot-toast";

type Category = "course" | "book" | "certification";

interface StudyItem {
  id: number;
  title: string;
  description: string | null;
  category: Category | null;
  resource_url: string | null;
  progress: number;
  status: "planned" | "in_progress" | "done";
}

const CATEGORY_LABELS: Record<Category, string> = {
  course: "Curso",
  book: "Livro",
  certification: "Certificação",
};

export default function StudyPage() {
  const router = useRouter();
  const [items, setItems] = useState<StudyItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) router.push("/login");
  }, [router]);

  const fetchItems = useCallback(async () => {
    try {
      const res = await apiRequest("/api/study");
      if (res.ok) {
        const data = await res.json();
        setItems(data.data ?? []);
      }
    } catch {
      toast.error("Erro ao carregar trilha de estudos");
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const updateProgress = async (id: number, progress: number) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, progress } : i)));
    const res = await apiRequest(`/api/study/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress }),
    });
    if (!res.ok) toast.error("Erro ao atualizar progresso");
    else fetchItems();
  };

  const addItem = async () => {
    if (!newTitle.trim()) {
      toast.error("Informe um título");
      return;
    }
    const res = await apiRequest("/api/study", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle,
        description: newDesc,
        resource_url: newUrl || null,
      }),
    });
    if (!res.ok) {
      toast.error("Erro ao adicionar item");
      return;
    }
    toast.success("Item adicionado!");
    setNewTitle("");
    setNewDesc("");
    setNewUrl("");
    setAdding(false);
    fetchItems();
  };

  const deleteItem = async (id: number) => {
    const res = await apiRequest(`/api/study/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Erro ao remover item");
      return;
    }
    toast.success("Item removido!");
    fetchItems();
  };

  return (
    <main
      className="flex flex-col min-h-screen px-8 py-8 lg:py-4"
      style={{ background: "var(--page-bg)" }}
    >
      <div className="flex flex-col lg:flex-row lg:justify-between gap-4 mt-14 lg:mt-0">
        <PageTitle
          title="Estudos"
          subTitle="Sua trilha de aprendizado e progresso"
        />
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 self-start px-4 py-2 rounded-md bg-cyan-600 text-white hover:bg-cyan-500"
        >
          <Plus className="w-4 h-4" /> Novo item
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
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          </div>
          <div>
            <Label>Link do recurso</Label>
            <Input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://..."
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
              onClick={addItem}
              className="px-4 py-2 rounded-md bg-cyan-600 text-white hover:bg-cyan-500"
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.length === 0 ? (
          <p className="text-[var(--card-text)]/60">Nenhum item de estudo.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border p-4 shadow-sm"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--card-border)",
                color: "var(--card-text)",
              }}
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  {item.category && (
                    <span className="text-[11px] text-[var(--plan-card-text)]">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setConfirmId(item.id)}
                  className="text-red-400 hover:text-red-500"
                  aria-label="Remover item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {item.description && (
                <p className="text-sm text-[var(--plan-card-text)] mt-1">
                  {item.description}
                </p>
              )}

              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[var(--plan-card-text)]">Progresso</span>
                  <span className="font-bold">{item.progress}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={item.progress}
                  onChange={(e) =>
                    updateProgress(item.id, Number(e.target.value))
                  }
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              {item.resource_url && (
                <a
                  href={item.resource_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-cyan-500 hover:underline mt-2"
                >
                  <ExternalLink className="w-3 h-3" /> Abrir recurso
                </a>
              )}
            </div>
          ))
        )}
      </section>

      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(open) => !open && setConfirmId(null)}
        title="Remover item"
        description="Tem certeza que deseja remover este item de estudo?"
        onCancel={() => setConfirmId(null)}
        onConfirm={() => {
          if (confirmId !== null) deleteItem(confirmId);
          setConfirmId(null);
        }}
      />
    </main>
  );
}
