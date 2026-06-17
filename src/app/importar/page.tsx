"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2, FileText } from "lucide-react";
import PageTitle from "@/components/pageTitle";
import { apiRequest, isAuthenticated } from "@/lib/auth";
import { formatCurrency } from "@/utils/format";
import { toast } from "react-hot-toast";

interface Category {
  id: number;
  nome: string;
  tipo: "despesa" | "receita";
}

interface ImportedTx {
  id: number;
  date: string;
  amount: number;
  description: string;
  type: "expense" | "income";
  category_id: number | null;
  status: "pending" | "confirmed" | "skipped" | "duplicate";
}

export default function ImportPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [txs, setTxs] = useState<ImportedTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) router.push("/login");
  }, [router]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiRequest("/api/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.data ?? []);
      }
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append("file", file);

    setLoading(true);
    const toastId = "import-upload";
    toast.loading("Processando extrato...", { id: toastId });
    try {
      const res = await apiRequest("/api/imports", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Erro ao processar o extrato.", { id: toastId });
        return;
      }
      setBatchId(data.data.batch.id);
      setTxs(data.data.transactions);
      const dup = data.data.summary?.duplicates ?? 0;
      toast.success(
        `${data.data.summary.total} transações encontradas${dup ? ` (${dup} duplicadas)` : ""}.`,
        { id: toastId }
      );
    } catch {
      toast.error("Erro ao enviar o arquivo.", { id: toastId });
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const patchTx = async (id: number, patch: Partial<ImportedTx>) => {
    setTxs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    await apiRequest(`/api/imports/transactions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  };

  const confirmImport = async () => {
    if (!batchId) return;
    setConfirming(true);
    const toastId = "import-confirm";
    toast.loading("Confirmando...", { id: toastId });
    try {
      const res = await apiRequest(`/api/imports/${batchId}`, { method: "PUT" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Erro ao confirmar.", { id: toastId });
        return;
      }
      toast.success(
        `Importado: ${data.data.created_expenses} despesas, ${data.data.created_incomes} receitas.`,
        { id: toastId }
      );
      setBatchId(null);
      setTxs([]);
    } catch {
      toast.error("Erro ao confirmar importação.", { id: toastId });
    } finally {
      setConfirming(false);
    }
  };

  const pendingCount = txs.filter((t) => t.status === "pending").length;

  return (
    <main
      className="flex flex-col min-h-screen px-8 py-8 lg:py-4"
      style={{ background: "var(--page-bg)" }}
    >
      <div className="mt-14 lg:mt-0">
        <PageTitle
          title="Importar extrato"
          subTitle="Envie um extrato (.ofx ou .pdf) e revise antes de salvar"
        />
      </div>

      {/* Upload */}
      <label
        className="mt-6 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors hover:bg-[var(--hover-bg)]"
        style={{ borderColor: "var(--card-border)", color: "var(--card-text)" }}
      >
        <Upload className="w-8 h-8 text-cyan-500" />
        <span className="font-medium">
          {loading ? "Processando..." : "Clique para enviar .ofx ou .pdf"}
        </span>
        <span className="text-xs text-[var(--plan-card-text)]">
          OFX (Nubank, BB, Santander, Bradesco, Itaú) · PDF (Mercado Pago)
        </span>
        <input
          type="file"
          accept=".ofx,.pdf"
          className="hidden"
          disabled={loading}
          onChange={handleUpload}
        />
      </label>

      {/* Revisão */}
      {txs.length > 0 && (
        <section className="mt-8">
          <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-[var(--card-text)] flex items-center gap-2">
              <FileText className="w-5 h-5" /> Revisar {txs.length} transações
            </h2>
            <button
              onClick={confirmImport}
              disabled={confirming || pendingCount === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-500 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirmar {pendingCount} lançamentos
            </button>
          </div>

          <div className="space-y-3">
            {txs.map((t) => {
              const opts = categories.filter((c) =>
                t.type === "income" ? c.tipo === "receita" : c.tipo === "despesa"
              );
              const isDup = t.status === "duplicate";
              const included = t.status === "pending";
              return (
                <div
                  key={t.id}
                  className="rounded-xl border p-4"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    borderColor: "var(--card-border)",
                    color: "var(--card-text)",
                    opacity: included ? 1 : 0.55,
                  }}
                >
                  {/* Descrição + valor */}
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <p className="font-medium break-words">{t.description}</p>
                      <p className="text-xs text-[var(--plan-card-text)] mt-0.5">
                        {new Date(`${t.date.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR")}
                        {isDup && (
                          <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-600">
                            duplicada
                          </span>
                        )}
                      </p>
                    </div>
                    <p
                      className={`font-semibold whitespace-nowrap ${
                        t.type === "income" ? "text-green-500" : "text-red-400"
                      }`}
                    >
                      {t.type === "income" ? "+" : "-"}
                      {formatCurrency(t.amount)}
                    </p>
                  </div>

                  {/* Controles: tipo, categoria, incluir */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <select
                      value={t.type}
                      onChange={(e) =>
                        patchTx(t.id, {
                          type: e.target.value as "expense" | "income",
                          category_id: null,
                        })
                      }
                      className="flex-1 min-w-[110px] bg-[var(--card-bg)] border rounded px-2 py-1.5 text-sm"
                      style={{ borderColor: "var(--card-border)" }}
                    >
                      <option value="expense">Despesa</option>
                      <option value="income">Receita</option>
                    </select>

                    <select
                      value={t.category_id ?? ""}
                      onChange={(e) =>
                        patchTx(t.id, {
                          category_id: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="flex-1 min-w-[120px] bg-[var(--card-bg)] border rounded px-2 py-1.5 text-sm"
                      style={{ borderColor: "var(--card-border)" }}
                    >
                      <option value="">Sem categoria</option>
                      {opts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>

                    <label className="flex items-center gap-2 text-sm whitespace-nowrap cursor-pointer">
                      <input
                        type="checkbox"
                        checked={included}
                        onChange={(e) =>
                          patchTx(t.id, { status: e.target.checked ? "pending" : "skipped" })
                        }
                        className="accent-green-600 w-4 h-4 cursor-pointer"
                      />
                      Incluir
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
