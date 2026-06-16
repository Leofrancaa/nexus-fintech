"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PageTitle from "@/components/pageTitle";
import { NewPlanModal } from "@/components/modals/newPlanModal";
import PlanCard from "@/components/cards/planCard";
import { apiRequest, isAuthenticated } from "@/lib/auth";
import { toast } from "react-hot-toast";

interface Plano {
  id: number;
  nome: string;
  meta: number;
  prazo: string;
  descricao?: string;
  total_contribuido: number;
  taxa_anual?: number | null;
  status?: string;
  progresso?: number;
  aporte_mensal_necessario?: number;
  taxa_utilizada?: number;
  taxa_fonte?: "custom" | "selic" | "fallback";
  meses_restantes?: number;
}

export default function Plans() {
  const router = useRouter();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
  }, [router]);

  const fetchPlanos = useCallback(async () => {
    try {
      const res = await apiRequest("/api/plans");
      if (!res.ok) throw new Error("Erro ao buscar planos");
      const data = await res.json();
      setPlanos(data.data || []);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessão expirada")) {
        router.push("/login");
      } else {
        toast.error("Erro ao buscar planos");
      }
    }
  }, [router]);

  useEffect(() => {
    fetchPlanos();
  }, [refreshKey, fetchPlanos]);

  return (
    <main
      className="flex flex-col min-h-screen px-8 py-8 lg:py-4"
      style={{ background: "var(--page-bg)" }}
    >
      <div className="flex flex-col lg:flex-row lg:justify-between gap-4 mt-14 lg:mt-0">
        <PageTitle title="Planos" subTitle="Gerencie e acompanhe seus planos" />
        <NewPlanModal onCreated={() => setRefreshKey((k) => k + 1)} />
      </div>

      <section className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {planos.length === 0 ? (
          <p className="text-[var(--card-text)]/60">Nenhum plano cadastrado.</p>
        ) : (
          planos.map((plano) => (
            <PlanCard
              key={plano.id}
              plano={plano}
              onRefresh={() => setRefreshKey((k) => k + 1)}
            />
          ))
        )}
      </section>
    </main>
  );
}
