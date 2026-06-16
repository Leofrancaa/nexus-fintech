"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

type Status = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Confirmando seu e-mail...");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      setMessage("Link inválido: token ausente.");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok) {
          setStatus("success");
          setMessage(data?.message || "E-mail confirmado! Você já pode entrar.");
        } else {
          setStatus("error");
          setMessage(data?.error || "Não foi possível confirmar o e-mail.");
        }
      } catch {
        setStatus("error");
        setMessage("Erro ao confirmar o e-mail. Tente novamente.");
      }
    })();
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0E1116] px-4">
      <div className="w-full max-w-md bg-[#111827] rounded-2xl shadow-lg px-8 py-10 border border-white/10 text-center">
        <div className="mx-auto mb-6 w-[140px]">
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

        {status === "loading" && (
          <Loader2 className="w-12 h-12 text-[#3B82F6] mx-auto animate-spin" />
        )}
        {status === "success" && (
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
        )}
        {status === "error" && <XCircle className="w-12 h-12 text-red-500 mx-auto" />}

        <p className="text-white mt-4">{message}</p>

        {status !== "loading" && (
          <Link
            href="/login"
            className="inline-block mt-6 px-6 py-3 rounded-md bg-[#3B82F6] text-white font-medium hover:opacity-90"
          >
            Ir para o login
          </Link>
        )}
      </div>
    </main>
  );
}
