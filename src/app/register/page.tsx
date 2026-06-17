"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, User, Eye, EyeOff, Ticket } from "lucide-react";
import { toast } from "react-hot-toast";

import Button from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register } from "@/lib/auth";
import { TermsModal } from "@/components/modals/termsModal";

export default function Signup() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome || !email || !senha || !confirmarSenha || !inviteCode) {
      toast.error("Por favor, preencha todas as informações");
      return;
    }

    if (senha !== confirmarSenha) {
      toast.error("As senhas digitadas não são iguais");
      return;
    }

    if (senha.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres");
      return;
    }

    if (!aceitouTermos) {
      toast.error("Você precisa aceitar os Termos e Condições para continuar");
      return;
    }

    try {
      const response = await register({ nome, email, senha, inviteCode });

      if (response.success) {
        toast.success("Cadastro realizado com sucesso!");
        router.push("/manual");
      } else {
        toast.error(response.message || "Não foi possível criar sua conta");
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Não foi possível completar o cadastro. Tente novamente");
      }
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-[#0E1116] px-4 overflow-hidden">
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

      <div className="relative z-10 w-full max-w-lg sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl bg-[#111827] rounded-2xl shadow-lg px-6 sm:px-8 md:px-10 pb-8">
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

          <h1 className="text-xl font-semibold text-white">Criar conta</h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 mt-2 flex flex-col 3xl:gap-4"
        >
          {/* Grid 2 colunas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nome */}
            <div>
              <Label htmlFor="nome">Nome completo</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                  className="pl-10 max-w-full"
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <Label htmlFor="senha">Senha</Label>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white"
                >
                  {showSenha ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Email */}
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

            {/* Confirmar Senha */}
            <div>
              <Label htmlFor="confirmarSenha">Confirmar Senha</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <Input
                  id="confirmarSenha"
                  type={showConfirmar ? "text" : "password"}
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="Confirme sua senha"
                  className="pl-10 pr-10 max-w-full"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmar(!showConfirmar)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white"
                >
                  {showConfirmar ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Código de Convite - Full width */}
          <div>
            <Label htmlFor="inviteCode">Código de Convite</Label>
            <div className="relative mt-1">
              <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <Input
                id="inviteCode"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Digite seu código de convite"
                className="pl-10 max-w-full uppercase"
                maxLength={32}
              />
            </div>
            <p className="text-xs text-[#9CA3AF] mt-1.5">
              Não tem um código?{" "}
              <a
                href="https://wa.me/5571996601709?text=Olá! Gostaria de obter um código de convite para o Nexus"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3B82F6] hover:underline font-medium"
              >
                Solicite aqui pelo WhatsApp
              </a>
            </p>
          </div>

          {/* Termos e Condições */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="termos"
              checked={aceitouTermos}
              onChange={(e) => setAceitouTermos(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-[#2A2E37] bg-[#1A1D23] text-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-0 cursor-pointer"
            />
            <label htmlFor="termos" className="text-sm text-[#9CA3AF] cursor-pointer">
              Eu li e aceito os{" "}
              <button
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="text-[#3B82F6] hover:underline font-medium"
              >
                Termos e Condições de Uso
              </button>
            </label>
          </div>

          <Button type="submit" className="h-12 max-w-full">
            Criar Conta
          </Button>

          <p className="text-md text-center text-[#9CA3AF] mt-4">
            Já tem uma conta?{" "}
            <Link
              href="/login"
              className="text-[#3B82F6] hover:underline font-medium text-lg"
            >
              Entre aqui
            </Link>
          </p>
        </form>
      </div>

      <TermsModal open={showTermsModal} onOpenChange={setShowTermsModal} />
    </main>
  );
}
