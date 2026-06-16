"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "react-hot-toast";

import Button from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RightShowcase } from "@/components/rightShowCase";
import { login, resendVerification, LoginError } from "@/lib/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const router = useRouter();

  const handleResend = async () => {
    if (!email) {
      toast.error("Informe seu e-mail para reenviar a confirmação");
      return;
    }
    setResending(true);
    try {
      const res = await resendVerification(email);
      toast.success(res.message || "E-mail de confirmação reenviado.");
    } catch {
      toast.error("Não foi possível reenviar agora. Tente novamente.");
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !senha) {
      toast.error("Por favor, preencha seu email e senha");
      return;
    }

    setLoading(true);
    setNeedsVerification(false);

    try {
      const response = await login({ email, senha });

      if (response.success) {
        toast.success("Login realizado com sucesso!");
        // Usar setTimeout para dar tempo do token ser salvo
        setTimeout(() => {
          router.push("/dashboard");
        }, 500);
      } else {
        toast.error(response.message || "Não foi possível fazer login. Verifique suas credenciais");
      }
    } catch (error: unknown) {
      if (error instanceof LoginError && error.code === "email_not_verified") {
        setNeedsVerification(true);
      }
      toast.error(
        error instanceof Error ? error.message : "Não foi possível completar a ação. Tente novamente"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-[#0E1116] overflow-hidden">
      {/* linhas do fundo que você já tinha */}
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
        {/* ESQUERDA: form (inalterado) */}
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
                Entrar na conta
              </h1>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 mt-2 flex flex-col"
            >
              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="pl-10 max-w-full"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <Label htmlFor="senha">Senha</Label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-[#3B82F6] hover:underline"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                  <Input
                    id="senha"
                    type={showSenha ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Sua senha"
                    className="pl-10 pr-10 max-w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha(!showSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] cursor-pointer hover:text-black"
                  >
                    {showSenha ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" className="h-12 max-w-full" disabled={loading}>
                Entrar
              </Button>

              {needsVerification && (
                <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-200">
                  <p>Seu e-mail ainda não foi confirmado.</p>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="mt-2 text-[#3B82F6] hover:underline font-medium disabled:opacity-50"
                  >
                    {resending ? "Reenviando..." : "Reenviar e-mail de confirmação"}
                  </button>
                </div>
              )}

              <p className="text-md text-center text-[#9CA3AF] mt-4">
                Não tem uma conta?{" "}
                <Link
                  href="/register"
                  className="text-[#3B82F6] hover:underline font-medium text-lg"
                >
                  Crie agora
                </Link>
              </p>
            </form>
          </div>
        </div>

        {/* DIREITA: painel estilo Lovable */}
        <RightShowcase />
      </div>
    </main>
  );
}
