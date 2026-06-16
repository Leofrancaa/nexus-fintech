CREATE TABLE "import_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"source" text NOT NULL,
	"format" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imported_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text NOT NULL,
	"type" text NOT NULL,
	"suggested_category_id" integer,
	"category_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"dedupe_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
