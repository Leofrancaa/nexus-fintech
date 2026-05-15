// src/components/cards/dashboardStatsCard.tsx
"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { apiRequest } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

interface Props {
  customMonth?: string;
  customYear?: string;
  refreshKey: number;
}

interface IncomeStats {
  total: number;
  anterior: number;
}

interface ExpenseStats {
  total: number;
  anterior: number;
}

export function DashboardCards({ customMonth, customYear, refreshKey }: Props) {
  const [incomes, setIncomes] = useState<IncomeStats>({
    total: 0,
    anterior: 0,
  });
  const [expenses, setExpenses] = useState<ExpenseStats>({
    total: 0,
    anterior: 0,
  });

  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const month = customMonth || String(new Date().getMonth() + 1);
  const year = customYear || String(new Date().getFullYear());

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);


        // Fazer todas as requisições em paralelo
        const [incomeRes, expenseRes] = await Promise.all([
          apiRequest(`/api/incomes/stats?month=${month}&year=${year}`),
          apiRequest(`/api/expenses/stats?month=${month}&year=${year}`),
        ]);

        // Verificar se todas as responses são válidas
        if (!incomeRes.ok) {
          throw new Error(
            `Erro ao buscar receitas: ${incomeRes.status} ${incomeRes.statusText}`
          );
        }
        if (!expenseRes.ok) {
          throw new Error(
            `Erro ao buscar despesas: ${expenseRes.status} ${expenseRes.statusText}`
          );
        }

        // Processar respostas
        const incomeData = await incomeRes.json();
        const expenseData = await expenseRes.json();

        console.log("Dados recebidos:", {
          incomeData,
          expenseData,
        });

        // As APIs retornam no formato { success: true, data: {...} }
        const incomeStats = incomeData.data || incomeData;
        const expenseStats = expenseData.data || expenseData;

        setIncomes({
          total: Number(incomeStats.total || 0),
          anterior: Number(incomeStats.anterior || 0),
        });

        setExpenses({
          total: Number(expenseStats.total || 0),
          anterior: Number(expenseStats.anterior || 0),
        });
      } catch (err) {
        console.error("Erro ao carregar dados do dashboard:", err);

        if (err instanceof Error) {
          if (
            err.message.includes("Sessão expirada") ||
            err.message.includes("401")
          ) {
            // Token expirado ou inválido
            router.push("/login");
            toast.error("Sessão expirada. Faça login novamente.");
          } else if (err.message.includes("403")) {
            // Token inválido
            router.push("/login");
            toast.error("Acesso não autorizado. Faça login novamente.");
          } else {
            toast.error("Erro ao carregar dados do dashboard");
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [month, year, refreshKey, router]);

  const saldoAtual = incomes.total - expenses.total;
  const saldoAnterior = incomes.anterior - expenses.anterior;

  // Calcular variação percentual
  const calcVariacao = (
    atual: number,
    anterior: number,
    positivoQuandoMaior: boolean
  ) => {
    if (anterior === 0) return null; // evita divisão por 0

    const delta = atual - anterior;
    const variacao = (delta / Math.abs(anterior)) * 100;
    const isPositiva = positivoQuandoMaior ? delta >= 0 : delta <= 0;

    return {
      texto: `${variacao >= 0 ? "+" : ""}${variacao.toFixed(1)}%`,
      isPositiva,
      icone: isPositiva ? "↗" : "↘",
      classe: isPositiva ? "text-green-600" : "text-red-600",
    };
  };

  const varReceitas = calcVariacao(incomes.total, incomes.anterior, true);
  const varDespesas = calcVariacao(expenses.total, expenses.anterior, false);
  const varSaldo = calcVariacao(saldoAtual, saldoAnterior, true);

  if (loading) {
    return (
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="flex flex-col justify-between bg-[var(--card-bg)] text-[var(--card-text)] border border-[var(--card-border)] rounded-xl p-5 h-full animate-pulse"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-gray-300"></div>
              <div className="flex flex-col">
                <div className="h-4 bg-gray-300 rounded mb-2 w-20"></div>
                <div className="h-6 bg-gray-300 rounded w-24"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Configurar cards com a estrutura exata solicitada
  const cards = [
    {
      title: "Receitas",
      value: incomes.total.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      icon: <TrendingUp className="text-green-600" />,
      bg: "bg-green-100",
      comparacao: varReceitas
        ? {
            icone: varReceitas.icone,
            texto: `${varReceitas.texto} vs mês anterior`,
            classe: varReceitas.classe,
          }
        : null,
    },
    {
      title: "Despesas",
      value: expenses.total.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      icon: <TrendingDown className="text-red-600" />,
      bg: "bg-red-100",
      comparacao: varDespesas
        ? {
            icone: varDespesas.icone,
            texto: `${varDespesas.texto} vs mês anterior`,
            classe: varDespesas.classe,
          }
        : null,
    },
    {
      title: "Saldo",
      value: saldoAtual.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      icon: (
        <Wallet
          className={saldoAtual >= 0 ? "text-blue-600" : "text-red-600"}
        />
      ),
      bg: saldoAtual >= 0 ? "bg-blue-100" : "bg-red-100",
      comparacao: varSaldo
        ? {
            icone: varSaldo.icone,
            texto: `${varSaldo.texto} vs mês anterior`,
            classe: varSaldo.classe,
          }
        : null,
    },
  ];

  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
      {cards.map((card, i) => (
        <div
          key={i}
          className="flex flex-col justify-between bg-[var(--card-bg)] text-[var(--card-text)] border border-[var(--card-border)] rounded-xl p-5 h-full"
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.bg}`}
            >
              {card.icon}
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">
                {card.title}
              </span>
              <span className="text-xl font-bold">{card.value}</span>
            </div>
          </div>
          {card.comparacao && (
            <div
              className={`mt-3 text-sm flex items-center gap-1 ${card.comparacao.classe}`}
            >
              <span className="text-xs">{card.comparacao.icone}</span>
              <span>{card.comparacao.texto}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
