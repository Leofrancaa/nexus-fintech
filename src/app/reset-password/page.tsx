"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { toast } from "react-hot-toast";

import Button from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RightShowcase } from "@/components/rightShowCase";

const API_URL = "/api";

function ResetPasswordForm() {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tokenFromUrl = searchParams.get("token");
    if (!tokenFromUrl) {
      toast.error("Token de recuperação inválido");
      router.push("/login");
    } else {
      setToken(tokenFromUrl);
    }
  }, [searchParams, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!novaSenha || !confirmarSenha) {
      toast.error("Por favor, preencha todos os campos");
      return;
    }

    if (novaSenha.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (novaSenha !== confirmarSenha) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (!token) {
      toast.error("Token inválido");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, novaSenha }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("Senha redefinida com sucesso! Redirecionando...");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } else {
        toast.error(data.message || "Erro ao redefinir senha. O token pode estar expirado.");
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível completar a ação. Tente novamente"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return null;
  }

  return (
    <main className="relative min-h-screen bg-[#0E1116] overflow-hidden">
      {/* linhas do fundo */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <svg
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <g strokeWidth="2">
            <line x1="0" y1="30%" x2="100%" y2="60%" stroke="#00D4AA" />
            <line x1="0" y1="70%" x2="100%" y2="50%" stroke="#00D4D4" />
            <line x1="10%" y1="0" x2="10%" y2="100%" stroke="#3B82F6" />
            <line
              x1="40%"
              y1="0"
              x2="60%"
              y2="100%"
              stroke="rgba(255,255,255,0.05)"
            />
            <line x1="80%" y1="0" x2="70%" y2="100%" stroke="#3B82F6" />
            <line
              x1="0"
              y1="50%"
              x2="100%"
              y2="50%"
              stroke="rgba(255,255,255,0.05)"
            />
            <line
              x1="0"
              y1="30%"
              x2="100%"
              y2="10%"
              stroke="rgba(255,255,255,0.05)"
            />
            <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#00D4AA" />
            <line x1="20%" y1="0" x2="90%" y2="100%" stroke="#3B82F6" />
          </g>
        </svg>
      </div>

      <div className="relative z-10 grid w-full min-h-screen lg:grid-cols-2">
        {/* ESQUERDA: form */}
        <div className="flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-lg sm:max-w-md lg:max-w-lg bg-[#111827] rounded-2xl shadow-lg px-6 sm:px-8 md:px-10 pb-8 border border-white/10">
            <div className="text-center">
              <div className="mx-auto mt-6 mb-6 w-[140px]">
                <Image
                  src="/logo-nexus.png"
                  alt="Logo Nexus"
                  width={0}
                  height={0}
                  sizes="100vw"
                  style={{ width: "100%", height: "auto" }}
                  priority
                />
              </div>
              <h1 className="text-2xl font-semibold text-white">
                Redefinir senha
              </h1>
              <p className="text-[#9CA3AF] mt-2">
                Digite sua nova senha
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 mt-6 flex flex-col"
            >
              <div>
                <Label htmlFor="novaSenha">Nova Senha</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                  <Input
                    id="novaSenha"
                    type={showNovaSenha ? "text" : "password"}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="pl-10 pr-10 max-w-full"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNovaSenha(!showNovaSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] cursor-pointer hover:text-white"
                  >
                    {showNovaSenha ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirmarSenha">Confirmar Senha</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                  <Input
                    id="confirmarSenha"
                    type={showConfirmarSenha ? "text" : "password"}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="Repita a senha"
                    className="pl-10 pr-10 max-w-full"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] cursor-pointer hover:text-white"
                  >
                    {showConfirmarSenha ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" className="h-12 max-w-full" disabled={loading}>
                {loading ? "Redefinindo..." : "Redefinir senha"}
              </Button>

              <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-[#9CA3AF] hover:text-white transition-colors mt-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para o login
              </Link>
            </form>
          </div>
        </div>

        {/* DIREITA: painel */}
        <RightShowcase />
      </div>
    </main>
  );
}

export default function ResetPassword() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
