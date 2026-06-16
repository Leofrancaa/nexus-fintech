CREATE TABLE "card_invoices_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"card_id" integer NOT NULL,
	"competencia_mes" integer NOT NULL,
	"competencia_ano" integer NOT NULL,
	"amount_paid" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "card_invoices_payments_user_card_competencia_key" UNIQUE("user_id","card_id","competencia_mes","competencia_ano")
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"tipo" text NOT NULL,
	"numero" text NOT NULL,
	"cor" text DEFAULT '#6B7280' NOT NULL,
	"limite" numeric(12, 2) DEFAULT '0' NOT NULL,
	"limite_disponivel" numeric(12, 2) DEFAULT '0' NOT NULL,
	"dia_vencimento" integer DEFAULT 1 NOT NULL,
	"dias_fechamento_antes" integer DEFAULT 10 NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"cor" text DEFAULT '#6B7280' NOT NULL,
	"tipo" text NOT NULL,
	"parent_id" integer,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"metodo_pagamento" text NOT NULL,
	"tipo" text NOT NULL,
	"quantidade" numeric(12, 2) NOT NULL,
	"fixo" boolean DEFAULT false NOT NULL,
	"data" date NOT NULL,
	"parcelas" integer,
	"frequencia" text,
	"user_id" integer NOT NULL,
	"card_id" integer,
	"category_id" integer,
	"observacoes" text,
	"competencia_mes" integer,
	"competencia_ano" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"nome" text NOT NULL,
	"valor_alvo" numeric(12, 2) NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "goals_user_mes_ano_key" UNIQUE("user_id","mes","ano")
);
--> statement-breakpoint
CREATE TABLE "incomes" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"quantidade" numeric(12, 2) NOT NULL,
	"nota" text,
	"data" date NOT NULL,
	"fonte" text,
	"fixo" boolean DEFAULT false NOT NULL,
	"user_id" integer NOT NULL,
	"category_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar NOT NULL,
	"created_by" integer NOT NULL,
	"is_used" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp,
	"used_by" integer,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invite_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "plan_contributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"valor" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"meta" numeric(12, 2) NOT NULL,
	"prazo" date NOT NULL,
	"status" text DEFAULT 'Iniciando' NOT NULL,
	"total_contribuido" numeric(12, 2) DEFAULT '0' NOT NULL,
	"taxa_anual" numeric(6, 4),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thresholds" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"valor" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "thresholds_user_category_key" UNIQUE("user_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha" text,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"accepted_terms" boolean DEFAULT false NOT NULL,
	"accepted_terms_at" timestamp,
	"reset_password_token" text,
	"reset_password_expires" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
