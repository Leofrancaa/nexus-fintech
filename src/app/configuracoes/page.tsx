"use client";

import { useState, useEffect } from "react";
import PageTitle from "@/components/pageTitle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Button from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Copy,
  Plus,
  Trash2,
  Shield,
} from "lucide-react";
import { getUserData } from "@/lib/auth";
import { toast } from "react-hot-toast";

const API_URL = "/api";
const ADMIN_EMAIL = "nexusfintool1962@gmail.com";

type InviteCode = {
  id: number;
  code: string;
  is_used: boolean;
  expires_at: string | null;
  created_at: string;
  used_at: string | null;
  used_by_name: string | null;
  used_by_email: string | null;
};

type User = {
  id: number;
  nome: string;
  email: string;
  created_at: string;
  accepted_terms_at: string;
};

export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState<"password" | "admin">("password");
  const [isAdmin, setIsAdmin] = useState(false);

  // Estado Alteração de Senha
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Estado Admin
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<string>("");

  // Debug: Monitorar mudanças no estado users
  useEffect(() => {
    console.log("🔍 Estado users atualizado:", users);
  }, [users]);

  // Verificar se é admin
  useEffect(() => {
    getUserData().then((user) => {
      if (user && user.email === ADMIN_EMAIL) {
        setIsAdmin(true);
      }
    });
  }, []);

  // Carregar dados admin
  useEffect(() => {
    console.log("🔍 useEffect Admin: isAdmin =", isAdmin, "activeTab =", activeTab);
    if (isAdmin && activeTab === "admin") {
      console.log("🔍 useEffect Admin: Condição atendida, carregando dados...");
      loadInviteCodes();
      loadUsers();
    }
  }, [isAdmin, activeTab]);

  const loadInviteCodes = async () => {
    try {
      const response = await fetch(`${API_URL}/invite-codes`);

      if (response.ok) {
        const data = await response.json();
        setInviteCodes(data.data || []);
      }
    } catch (error) {
      console.error("Erro ao carregar códigos:", error);
    }
  };

  const loadUsers = async () => {
    console.log("🔍 loadUsers: Iniciando carregamento de usuários...");
    try {
      const response = await fetch(`${API_URL}/admin/users`);

      console.log("🔍 loadUsers: Status da resposta:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("🔍 loadUsers: Dados recebidos:", data);
        console.log("🔍 loadUsers: Número de usuários:", data.data?.length || 0);
        setUsers(data.data || []);
      } else {
        const errorData = await response.json();
        console.error("🔍 loadUsers: Erro na resposta:", errorData);
      }
    } catch (error) {
      console.error("🔍 loadUsers: Erro ao carregar usuários:", error);
    }
  };

  const handleGenerateCode = async () => {
    setLoadingAdmin(true);
    try {
      const body: { expiresInDays?: number } = {};
      if (expiresInDays) {
        body.expiresInDays = parseInt(expiresInDays);
      }

      const response = await fetch(`${API_URL}/invite-codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success("Código gerado com sucesso!");
        setExpiresInDays("");
        loadInviteCodes();
      } else {
        const data = await response.json();
        toast.error(data.message || "Erro ao gerar código");
      }
    } catch {
      toast.error("Erro ao gerar código");
    } finally {
      setLoadingAdmin(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  const handleDeleteCode = async (id: number) => {
    if (!confirm("Deseja realmente deletar este código?")) return;

    try {
      const response = await fetch(`${API_URL}/invite-codes/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Código deletado!");
        loadInviteCodes();
      } else {
        const data = await response.json();
        toast.error(data.message || "Erro ao deletar código");
      }
    } catch {
      toast.error("Erro ao deletar código");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      setMessage({
        type: "error",
        text: "Todos os campos são obrigatórios.",
      });
      return;
    }

    if (novaSenha.length < 6) {
      setMessage({
        type: "error",
        text: "A nova senha deve ter pelo menos 6 caracteres.",
      });
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setMessage({
        type: "error",
        text: "A nova senha e a confirmação não coincidem.",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaAtual, novaSenha }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: "success",
          text: "Senha alterada com sucesso!",
        });
        setSenhaAtual("");
        setNovaSenha("");
        setConfirmarSenha("");
      } else {
        setMessage({
          type: "error",
          text: data.message || data.error || "Erro ao alterar senha.",
        });
      }
    } catch (error) {
      console.error("Erro ao alterar senha:", error);
      setMessage({
        type: "error",
        text: "Erro de conexão com o servidor.",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <main className="flex flex-col min-h-screen bg-[var(--page-bg)] px-8 py-8 lg:py-4">
      <div className="flex flex-col lg:flex-row lg:justify-between gap-4 mt-14 lg:mt-0">
        <PageTitle
          title="Configurações"
          subTitle="Gerencie suas preferências e segurança da conta"
        />
      </div>

      {/* Tabs */}
      <div className="mt-8">
        <div className="flex gap-2 border-b border-[var(--card-border)]">
          <button
            onClick={() => setActiveTab("password")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "password"
                ? "text-[#3B82F6] border-b-2 border-[#3B82F6]"
                : "text-[var(--foreground)]/60 hover:text-[var(--foreground)]"
            }`}
          >
            Alterar Senha
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
                activeTab === "admin"
                  ? "text-[#3B82F6] border-b-2 border-[#3B82F6]"
                  : "text-[var(--foreground)]/60 hover:text-[var(--foreground)]"
              }`}
            >
              <Shield className="w-4 h-4" />
              Admin
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo das Tabs */}
      {activeTab === "password" && (
        <div className="mt-6 max-w-2xl">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6">Alterar Senha</h2>

            {message && (
              <div
                className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
                  message.type === "success"
                    ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800"
                    : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800"
                }`}
              >
                {message.type === "success" ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm">{message.text}</p>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="senhaAtual">Senha Atual</Label>
                <div className="relative">
                  <Input
                    id="senhaAtual"
                    type={showSenhaAtual ? "text" : "password"}
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    placeholder="Digite sua senha atual"
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenhaAtual(!showSenhaAtual)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--filter-placeholder)] hover:text-[var(--filter-text)] transition-colors"
                    tabIndex={-1}
                  >
                    {showSenhaAtual ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="novaSenha">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="novaSenha"
                    type={showNovaSenha ? "text" : "password"}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Digite sua nova senha"
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNovaSenha(!showNovaSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--filter-placeholder)] hover:text-[var(--filter-text)] transition-colors"
                    tabIndex={-1}
                  >
                    {showNovaSenha ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-[var(--filter-placeholder)]">
                  Mínimo de 6 caracteres
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmarSenha">Confirmar Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="confirmarSenha"
                    type={showConfirmarSenha ? "text" : "password"}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="Confirme sua nova senha"
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--filter-placeholder)] hover:text-[var(--filter-text)] transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmarSenha ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? "Alterando..." : "Alterar Senha"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {activeTab === "admin" && isAdmin && (
        <div className="mt-6 space-y-6">
          {/* Gerar Código */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Gerar Código de Convite</h2>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 max-w-xs">
                <Label htmlFor="expiresInDays">
                  Expira em (dias) - Opcional
                </Label>
                <Input
                  id="expiresInDays"
                  type="number"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  placeholder="Ex: 7"
                  min="1"
                  className="mt-1"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleGenerateCode}
                  disabled={loadingAdmin}
                  className="flex items-center gap-2 h-10 px-4 rounded-lg bg-gradient-to-r from-[#2256FF] via-[#00D4AA] to-[#00D4D4] text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-all whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Gerar Código
                </button>
              </div>
            </div>
          </Card>

          {/* Lista de Códigos */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">
              Códigos de Convite ({inviteCodes.length})
            </h2>
            <div className="space-y-3">
              {inviteCodes.map((code) => (
                <div
                  key={code.id}
                  className="flex items-center justify-between gap-3 p-4 bg-[var(--page-bg)] rounded-lg border border-[var(--card-border)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <code className="text-lg font-mono font-bold text-[#3B82F6] break-all">
                        {code.code}
                      </code>
                      {code.is_used ? (
                        <span className="px-2 py-1 text-xs bg-green-500/20 text-green-500 rounded">
                          Usado
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-500 rounded">
                          Disponível
                        </span>
                      )}
                    </div>
                    {code.is_used && code.used_by_name && (
                      <p className="text-sm text-[var(--foreground)]/60 mt-1 break-words">
                        Usado por: {code.used_by_name} ({code.used_by_email}) em{" "}
                        {formatDate(code.used_at!)}
                      </p>
                    )}
                    {code.expires_at && (
                      <p className="text-xs text-[var(--foreground)]/60 mt-1">
                        Expira em: {formatDate(code.expires_at)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleCopyCode(code.code)}
                      className="p-2 hover:bg-[var(--hover-bg)] rounded transition-colors"
                      title="Copiar código"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    {!code.is_used && (
                      <button
                        onClick={() => handleDeleteCode(code.id)}
                        className="p-2 hover:bg-red-500/10 text-red-500 rounded transition-colors"
                        title="Deletar código"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {inviteCodes.length === 0 && (
                <p className="text-center text-[var(--foreground)]/60 py-8">
                  Nenhum código gerado ainda
                </p>
              )}
            </div>
          </Card>

          {/* Lista de Usuários */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">
              Usuários Cadastrados ({users.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    <th className="text-left p-3 text-sm font-semibold">Nome</th>
                    <th className="text-left p-3 text-sm font-semibold">Email</th>
                    <th className="text-left p-3 text-sm font-semibold">
                      Data de Cadastro
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-[var(--card-border)] hover:bg-[var(--hover-bg)] transition-colors"
                    >
                      <td className="p-3 text-sm">{user.nome}</td>
                      <td className="p-3 text-sm">{user.email}</td>
                      <td className="p-3 text-sm">{formatDate(user.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <p className="text-center text-[var(--foreground)]/60 py-8">
                  Nenhum usuário cadastrado
                </p>
              )}
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
