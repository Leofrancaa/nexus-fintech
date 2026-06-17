"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ExternalLink, Pencil } from "lucide-react";
import PageTitle from "@/components/pageTitle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textArea";
import ConfirmDialog from "@/components/ui/confirmDialog";
import {
  StatusSelect,
  MilestoneStatus,
} from "@/components/shared/statusSelect";
import { apiRequest, isAuthenticated } from "@/lib/auth";
import { toast } from "react-hot-toast";

type Horizon = "0-6m" | "6-18m" | "18-36m";

interface Milestone {
  id: number;
  title: string;
  description: string | null;
  horizon: Horizon;
  status: MilestoneStatus;
  resource_url: string | null;
}

interface Profile {
  north_star: string | null;
  track: "technical" | "product" | null;
  rationale: string | null;
  principles: string[];
}

const HORIZONS: { key: Horizon; label: string }[] = [
  { key: "0-6m", label: "Horizonte 0–6 meses · Consolidar a base" },
  { key: "6-18m", label: "Horizonte 6–18 meses · Especialização" },
  { key: "18-36m", label: "Horizonte 18–36 meses · Liderança" },
];

export default function CareerPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState(0);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [adding, setAdding] = useState<Horizon | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);

  // Edição do perfil (norte, trilha, justificativa, princípios)
  const [editingProfile, setEditingProfile] = useState(false);
  const [pNorth, setPNorth] = useState("");
  const [pTrack, setPTrack] = useState<"" | "technical" | "product">("");
  const [pRationale, setPRationale] = useState("");
  const [pPrinciples, setPPrinciples] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) router.push("/login");
  }, [router]);

  const fetchAll = useCallback(async () => {
    try {
      const [pRes, mRes] = await Promise.all([
        apiRequest("/api/career/profile"),
        apiRequest("/api/career/milestones"),
      ]);
      if (pRes.ok) {
        const data = await pRes.json();
        setProfile(data.data?.profile ?? null);
        setProgress(data.data?.progress ?? 0);
      }
      if (mRes.ok) {
        const data = await mRes.json();
        setMilestones(data.data ?? []);
      }
    } catch {
      toast.error("Erro ao carregar plano de carreira");
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const changeStatus = async (id: number, status: MilestoneStatus) => {
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status } : m))
    );
    const res = await apiRequest(`/api/career/milestones/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast.error("Erro ao atualizar status");
      fetchAll();
    } else {
      fetchAll();
    }
  };

  const addMilestone = async (horizon: Horizon) => {
    if (!newTitle.trim()) {
      toast.error("Informe um título para o marco");
      return;
    }
    const res = await apiRequest("/api/career/milestones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, description: newDesc, horizon }),
    });
    if (!res.ok) {
      toast.error("Erro ao adicionar marco");
      return;
    }
    toast.success("Marco adicionado!");
    setNewTitle("");
    setNewDesc("");
    setAdding(null);
    fetchAll();
  };

  const deleteMilestone = async (id: number) => {
    const res = await apiRequest(`/api/career/milestones/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Erro ao remover marco");
      return;
    }
    toast.success("Marco removido!");
    fetchAll();
  };

  const startEditProfile = () => {
    setPNorth(profile?.north_star ?? "");
    setPTrack(profile?.track ?? "");
    setPRationale(profile?.rationale ?? "");
    setPPrinciples((profile?.principles ?? []).join("\n"));
    setEditingProfile(true);
  };

  const saveProfile = async () => {
    const principles = pPrinciples
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await apiRequest("/api/career/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        north_star: pNorth.trim() || null,
        track: pTrack || null,
        rationale: pRationale.trim() || null,
        principles,
      }),
    });
    if (!res.ok) {
      toast.error("Erro ao salvar o plano");
      return;
    }
    toast.success("Plano de carreira atualizado!");
    setEditingProfile(false);
    fetchAll();
  };

  return (
    <main
      className="flex flex-col min-h-screen px-8 py-8 lg:py-4"
      style={{ background: "var(--page-bg)" }}
    >
      <div className="mt-14 lg:mt-0">
        <PageTitle
          title="Carreira"
          subTitle="Seu plano de carreira por horizontes"
        />
      </div>

      {/* Norte estratégico + progresso */}
      {profile && (
        <section
          className="mt-6 rounded-xl border p-5 shadow-lg"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
            color: "var(--card-text)",
          }}
        >
          <div className="flex justify-between items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-[260px]">
              <p className="text-xs uppercase tracking-wide text-[var(--plan-card-text)]">
                Norte estratégico
              </p>
              {!editingProfile && (
                <p className="text-lg font-semibold">
                  {profile.north_star || "Defina o seu objetivo de carreira"}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-[var(--plan-card-text)]">Conclusão</p>
                <p className="text-2xl font-bold text-cyan-500">{progress}%</p>
              </div>
              {!editingProfile && (
                <button
                  onClick={startEditProfile}
                  className="flex items-center gap-1 text-sm text-cyan-500 hover:opacity-80"
                >
                  <Pencil className="w-4 h-4" /> Editar
                </button>
              )}
            </div>
          </div>

          <div
            className="w-full h-2 rounded-full overflow-hidden mt-3"
            style={{ backgroundColor: "var(--progress-bg)" }}
          >
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${progress}%`, backgroundColor: "#059669" }}
            />
          </div>

          {editingProfile ? (
            <div className="mt-4 space-y-3">
              <div>
                <Label>Norte estratégico</Label>
                <Input
                  value={pNorth}
                  onChange={(e) => setPNorth(e.target.value)}
                  placeholder="Ex: Tornar-me Tech Lead em 3 anos"
                />
              </div>
              <div>
                <Label>Trilha</Label>
                <select
                  value={pTrack}
                  onChange={(e) =>
                    setPTrack(e.target.value as "" | "technical" | "product")
                  }
                  className="w-full bg-[var(--card-bg)] border rounded px-3 py-2"
                  style={{ borderColor: "var(--card-border)", color: "var(--card-text)" }}
                >
                  <option value="">Indefinida</option>
                  <option value="technical">Técnica</option>
                  <option value="product">Produto</option>
                </select>
              </div>
              <div>
                <Label>Justificativa (por quê)</Label>
                <Textarea
                  value={pRationale}
                  onChange={(e) => setPRationale(e.target.value)}
                />
              </div>
              <div>
                <Label>Princípios (um por linha)</Label>
                <Textarea
                  value={pPrinciples}
                  onChange={(e) => setPPrinciples(e.target.value)}
                  rows={5}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditingProfile(false)}
                  className="px-4 py-2 rounded-md bg-[#1F2937] text-white hover:bg-[#374151]"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveProfile}
                  className="px-4 py-2 rounded-md bg-cyan-600 text-white hover:bg-cyan-500"
                >
                  Salvar
                </button>
              </div>
            </div>
          ) : (
            <>
              {profile.rationale && (
                <p className="text-sm text-[var(--plan-card-text)] mt-4">
                  {profile.rationale}
                </p>
              )}

              {profile.principles?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold mb-1">
                    Princípios para acelerar
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-[var(--plan-card-text)]">
                    {profile.principles.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Marcos por horizonte */}
      {HORIZONS.map(({ key, label }) => {
        const items = milestones.filter((m) => m.horizon === key);
        return (
          <section key={key} className="mt-8">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-[var(--card-text)]">
                {label}
              </h2>
              <button
                onClick={() => {
                  setAdding(adding === key ? null : key);
                  setNewTitle("");
                  setNewDesc("");
                }}
                className="flex items-center gap-1 text-sm text-cyan-500 hover:opacity-80"
              >
                <Plus className="w-4 h-4" /> Adicionar marco
              </button>
            </div>

            {adding === key && (
              <div
                className="rounded-xl border p-4 mb-3 space-y-3"
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
                    placeholder="Ex: Aprender TensorRT"
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setAdding(null)}
                    className="px-4 py-2 rounded-md bg-[#1F2937] text-white hover:bg-[#374151]"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => addMilestone(key)}
                    className="px-4 py-2 rounded-md bg-cyan-600 text-white hover:bg-cyan-500"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border p-4 shadow-sm"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    borderColor: "var(--card-border)",
                    color: "var(--card-text)",
                  }}
                >
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-semibold">{m.title}</h3>
                    <StatusSelect
                      value={m.status}
                      onChange={(s) => changeStatus(m.id, s)}
                    />
                  </div>
                  {m.description && (
                    <p className="text-sm text-[var(--plan-card-text)] mt-1">
                      {m.description}
                    </p>
                  )}
                  <div className="flex justify-between items-center mt-3">
                    {m.resource_url ? (
                      <a
                        href={m.resource_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-cyan-500 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" /> Recurso
                      </a>
                    ) : (
                      <span />
                    )}
                    <button
                      onClick={() => setConfirmId(m.id)}
                      className="text-red-400 hover:text-red-500"
                      aria-label="Remover marco"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-sm text-[var(--card-text)]/50">
                  Nenhum marco neste horizonte.
                </p>
              )}
            </div>
          </section>
        );
      })}

      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(open) => !open && setConfirmId(null)}
        title="Remover marco"
        description="Tem certeza que deseja remover este marco do plano?"
        onCancel={() => setConfirmId(null)}
        onConfirm={() => {
          if (confirmId !== null) deleteMilestone(confirmId);
          setConfirmId(null);
        }}
      />
    </main>
  );
}
