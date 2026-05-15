"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail, ArrowLeft } from "lucide-react";
import { toast } from "react-hot-toast";

import Button from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RightShowcase } from "@/components/rightShowCase";

const API_URL = "/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Por favor, preencha seu email");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
        setEmailSent(true);
      } else {
        toast.error(data.message || "Erro ao enviar email de recuperação");
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível completar a ação. Tente novamente"
      );
    } finally {
      setLoading(false);
    }
  };

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
                Recuperar senha
              </h1>
              <p className="text-[#9CA3AF] mt-2">
                Digite seu email para receber instruções de recuperação
              </p>
            </div>

            {!emailSent ? (
              <form
                onSubmit={handleSubmit}
                className="space-y-5 mt-6 flex flex-col"
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
                      disabled={loading}
                    />
                  </div>
                </div>

                <Button type="submit" className="h-12 max-w-full" disabled={loading}>
                  {loading ? "Enviando..." : "Enviar link de recuperação"}
                </Button>

                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 text-[#9CA3AF] hover:text-white transition-colors mt-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para o login
                </Link>
              </form>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4">
                  <p className="text-green-400 text-center">
                    Email enviado com sucesso!
                  </p>
                  <p className="text-[#9CA3AF] text-sm text-center mt-2">
                    Verifique sua caixa de entrada e spam. O link expira em 1 hora.
                  </p>
                </div>

                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 text-[#9CA3AF] hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para o login
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* DIREITA: painel */}
        <RightShowcase />
      </div>
    </main>
  );
}
