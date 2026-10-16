-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "WalletKind" AS ENUM ('EXTERNAL', 'EMBEDDED');

-- CreateEnum
CREATE TYPE "KybStatus" AS ENUM ('NOT_STARTED', 'COMPANY_PENDING', 'PERSONS_PENDING', 'MANUAL_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "KybDecision" AS ENUM ('ACCEPT', 'REVIEW', 'REJECT');

-- CreateEnum
CREATE TYPE "KybCheckKind" AS ENUM ('COMPANY', 'PERSON');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "privy_did" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "user_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("user_id","institution_id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "kind" "WalletKind" NOT NULL,
    "user_id" UUID NOT NULL,
    "institution_id" UUID,
    "whitelist_chain_id" INTEGER,
    "whitelist_tx_hash" TEXT,
    "whitelisted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyb_cases" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "status" "KybStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "provider" TEXT NOT NULL,
    "company_data" JSONB,
    "registry_found" BOOLEAN,
    "reject_reason" TEXT,
    "reviewed_by" UUID,
    "review_note" TEXT,
    "submitted_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyb_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyb_checks" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "kind" "KybCheckKind" NOT NULL,
    "provider_transaction_id" TEXT,
    "person_name" TEXT,
    "person_role" TEXT,
    "ownership_percent" DECIMAL(5,2),
    "person_email" TEXT,
    "session_url" TEXT,
    "decision" "KybDecision",
    "warnings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyb_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyb_events" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyb_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_privy_did_key" ON "users"("privy_did");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_address_key" ON "wallets"("address");

-- CreateIndex
CREATE INDEX "wallets_institution_id_idx" ON "wallets"("institution_id");

-- CreateIndex
CREATE UNIQUE INDEX "kyb_cases_institution_id_key" ON "kyb_cases"("institution_id");

-- CreateIndex
CREATE UNIQUE INDEX "kyb_checks_provider_transaction_id_key" ON "kyb_checks"("provider_transaction_id");

-- CreateIndex
CREATE INDEX "kyb_checks_case_id_idx" ON "kyb_checks"("case_id");

-- CreateIndex
CREATE UNIQUE INDEX "kyb_events_provider_transaction_id_event_type_key" ON "kyb_events"("provider", "transaction_id", "event_type");

-- CreateIndex
CREATE INDEX "audit_logs_target_idx" ON "audit_logs"("target");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyb_cases" ADD CONSTRAINT "kyb_cases_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyb_checks" ADD CONSTRAINT "kyb_checks_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "kyb_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
