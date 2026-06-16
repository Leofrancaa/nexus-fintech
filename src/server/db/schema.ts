import {
  pgTable,
  serial,
  integer,
  text,
  varchar,
  boolean,
  numeric,
  timestamp,
  date,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core'

// Timestamps reutilizados (created_at / updated_at) — mantêm o comportamento do Prisma
// (retornam objetos Date e atualizam updated_at automaticamente).
const timestamps = {
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(),
  senha: text('senha'),
  currency: text('currency').default('BRL').notNull(),
  accepted_terms: boolean('accepted_terms').default(false).notNull(),
  accepted_terms_at: timestamp('accepted_terms_at', { mode: 'date' }),
  reset_password_token: text('reset_password_token'),
  reset_password_expires: timestamp('reset_password_expires', { mode: 'date' }),
  // Confirmação de e-mail no cadastro.
  email_verified: boolean('email_verified').default(false).notNull(),
  verification_token: text('verification_token'),
  verification_expires: timestamp('verification_expires', { mode: 'date' }),
  ...timestamps,
})

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull(),
  cor: text('cor').default('#6B7280').notNull(),
  tipo: text('tipo').notNull(),
  parent_id: integer('parent_id'),
  user_id: integer('user_id').notNull(),
  ...timestamps,
})

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  metodo_pagamento: text('metodo_pagamento').notNull(),
  tipo: text('tipo').notNull(),
  quantidade: numeric('quantidade', { precision: 12, scale: 2 }).notNull(),
  fixo: boolean('fixo').default(false).notNull(),
  data: date('data', { mode: 'date' }).notNull(),
  parcelas: integer('parcelas'),
  frequencia: text('frequencia'),
  user_id: integer('user_id').notNull(),
  card_id: integer('card_id'),
  category_id: integer('category_id'),
  observacoes: text('observacoes'),
  competencia_mes: integer('competencia_mes'),
  competencia_ano: integer('competencia_ano'),
  ...timestamps,
})

export const incomes = pgTable('incomes', {
  id: serial('id').primaryKey(),
  tipo: text('tipo').notNull(),
  quantidade: numeric('quantidade', { precision: 12, scale: 2 }).notNull(),
  nota: text('nota'),
  data: date('data', { mode: 'date' }).notNull(),
  fonte: text('fonte'),
  fixo: boolean('fixo').default(false).notNull(),
  user_id: integer('user_id').notNull(),
  category_id: integer('category_id'),
  ...timestamps,
})

export const cards = pgTable('cards', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull(),
  tipo: text('tipo').notNull(),
  numero: text('numero').notNull(),
  cor: text('cor').default('#6B7280').notNull(),
  limite: numeric('limite', { precision: 12, scale: 2 }).default('0').notNull(),
  limite_disponivel: numeric('limite_disponivel', { precision: 12, scale: 2 })
    .default('0')
    .notNull(),
  dia_vencimento: integer('dia_vencimento').default(1).notNull(),
  dias_fechamento_antes: integer('dias_fechamento_antes').default(10).notNull(),
  user_id: integer('user_id').notNull(),
  ...timestamps,
})

export const cardInvoicesPayments = pgTable(
  'card_invoices_payments',
  {
    id: serial('id').primaryKey(),
    user_id: integer('user_id').notNull(),
    card_id: integer('card_id').notNull(),
    competencia_mes: integer('competencia_mes').notNull(),
    competencia_ano: integer('competencia_ano').notNull(),
    amount_paid: numeric('amount_paid', { precision: 12, scale: 2 }).notNull(),
    created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    unique('card_invoices_payments_user_card_competencia_key').on(
      t.user_id,
      t.card_id,
      t.competencia_mes,
      t.competencia_ano
    ),
  ]
)

export const goals = pgTable(
  'goals',
  {
    id: serial('id').primaryKey(),
    user_id: integer('user_id').notNull(),
    nome: text('nome').notNull(),
    valor_alvo: numeric('valor_alvo', { precision: 12, scale: 2 }).notNull(),
    mes: integer('mes').notNull(),
    ano: integer('ano').notNull(),
    ...timestamps,
  },
  (t) => [unique('goals_user_mes_ano_key').on(t.user_id, t.mes, t.ano)]
)

export const plans = pgTable('plans', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  nome: text('nome').notNull(),
  descricao: text('descricao'),
  meta: numeric('meta', { precision: 12, scale: 2 }).notNull(),
  prazo: date('prazo', { mode: 'date' }).notNull(),
  status: text('status').default('Iniciando').notNull(),
  total_contribuido: numeric('total_contribuido', { precision: 12, scale: 2 })
    .default('0')
    .notNull(),
  // Coluna nova (aditiva, nullable): taxa anual personalizada em % a.a.
  // Quando null, o cálculo de aporte usa a Selic ao vivo.
  taxa_anual: numeric('taxa_anual', { precision: 6, scale: 4 }),
  ...timestamps,
})

export const planContributions = pgTable('plan_contributions', {
  id: serial('id').primaryKey(),
  plan_id: integer('plan_id').notNull(),
  user_id: integer('user_id').notNull(),
  valor: numeric('valor', { precision: 12, scale: 2 }).notNull(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
})

export const thresholds = pgTable(
  'thresholds',
  {
    id: serial('id').primaryKey(),
    user_id: integer('user_id').notNull(),
    category_id: integer('category_id').notNull(),
    valor: numeric('valor', { precision: 12, scale: 2 }).notNull(),
    ...timestamps,
  },
  (t) => [unique('thresholds_user_category_key').on(t.user_id, t.category_id)]
)

// ===== Career / Study / Personal (non-financial modules) =====
// All column names in English by request.

// Strategic narrative for the career module — one editable row per user.
export const careerProfile = pgTable('career_profile', {
  user_id: integer('user_id').primaryKey(),
  // Strategic north (target role/positioning).
  north_star: text('north_star'),
  // Chosen flavor: 'technical' | 'product' | null (undecided).
  track: text('track'),
  // The "why this path" rationale.
  rationale: text('rationale'),
  // Acceleration principles (editable list).
  principles: jsonb('principles').$type<string[]>().default([]).notNull(),
  ...timestamps,
})

// Career milestones grouped by horizon, each trackable by status.
export const careerMilestones = pgTable('career_milestones', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  // '0-6m' | '6-18m' | '18-36m'
  horizon: text('horizon').notNull(),
  // 'planned' | 'in_progress' | 'done'
  status: text('status').default('planned').notNull(),
  resource_url: text('resource_url'),
  position: integer('position').default(0).notNull(),
  ...timestamps,
})

// Study track items (courses, books, certifications) with progress.
export const studyItems = pgTable('study_items', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  // 'course' | 'book' | 'certification' | null
  category: text('category'),
  resource_url: text('resource_url'),
  // 0-100
  progress: integer('progress').default(0).notNull(),
  // 'planned' | 'in_progress' | 'done'
  status: text('status').default('planned').notNull(),
  position: integer('position').default(0).notNull(),
  ...timestamps,
})

// Personal life goals with optional target date.
export const personalGoals = pgTable('personal_goals', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  // 'planned' | 'in_progress' | 'done'
  status: text('status').default('planned').notNull(),
  target_date: date('target_date', { mode: 'date' }),
  position: integer('position').default(0).notNull(),
  ...timestamps,
})

// ===== Bank statement import (extrato) =====

// One upload/parse run of a bank statement.
export const importBatches = pgTable('import_batches', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  // Original file name / bank label.
  source: text('source').notNull(),
  // 'ofx' | 'pdf'
  format: text('format').notNull(),
  // 'pending' | 'confirmed' | 'discarded'
  status: text('status').default('pending').notNull(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
})

// A single parsed transaction awaiting review/confirmation.
export const importedTransactions = pgTable('imported_transactions', {
  id: serial('id').primaryKey(),
  batch_id: integer('batch_id').notNull(),
  user_id: integer('user_id').notNull(),
  date: date('date', { mode: 'date' }).notNull(),
  // Absolute value; sign is captured by `type`.
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description').notNull(),
  // 'expense' | 'income'
  type: text('type').notNull(),
  // Category suggested automatically (rules/LLM); user can override.
  suggested_category_id: integer('suggested_category_id'),
  category_id: integer('category_id'),
  // 'pending' | 'confirmed' | 'skipped' | 'duplicate'
  status: text('status').default('pending').notNull(),
  // sha256(user_id|date|amount|type|normalized description) — prevents re-import.
  dedupe_hash: text('dedupe_hash').notNull(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
})

// ===== AI assistant chat (Qwen) =====
// Histórico de mensagens; também usado para contar o limite diário por usuário.
export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  // 'user' | 'assistant'
  role: text('role').notNull(),
  content: text('content').notNull(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
})

export const inviteCodes = pgTable('invite_codes', {
  id: serial('id').primaryKey(),
  code: varchar('code').notNull().unique(),
  created_by: integer('created_by').notNull(),
  is_used: boolean('is_used').default(false).notNull(),
  expires_at: timestamp('expires_at', { mode: 'date' }),
  used_by: integer('used_by'),
  used_at: timestamp('used_at', { mode: 'date' }),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
})
