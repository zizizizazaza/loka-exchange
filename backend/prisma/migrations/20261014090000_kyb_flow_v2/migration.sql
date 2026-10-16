-- AlterEnum
BEGIN;
CREATE TYPE "KybCheckKind_new" AS ENUM ('COMPANY', 'APPLICANT_ID', 'SCREENING', 'PERSON_ID');
ALTER TABLE "kyb_checks" ALTER COLUMN "kind" TYPE "KybCheckKind_new" USING ("kind"::text::"KybCheckKind_new");
ALTER TYPE "KybCheckKind" RENAME TO "KybCheckKind_old";
ALTER TYPE "KybCheckKind_new" RENAME TO "KybCheckKind";
DROP TYPE "public"."KybCheckKind_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "KybStatus_new" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'INFO_REQUESTED', 'APPROVED', 'REJECTED', 'SUSPENDED');
ALTER TABLE "public"."kyb_cases" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "kyb_cases" ALTER COLUMN "status" TYPE "KybStatus_new" USING ("status"::text::"KybStatus_new");
ALTER TYPE "KybStatus" RENAME TO "KybStatus_old";
ALTER TYPE "KybStatus_new" RENAME TO "KybStatus";
DROP TYPE "public"."KybStatus_old";
ALTER TABLE "kyb_cases" ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED';
COMMIT;

-- AlterTable
ALTER TABLE "kyb_cases" ADD COLUMN     "applicant_user_id" UUID,
ADD COLUMN     "draft" JSONB;

-- AlterTable
ALTER TABLE "kyb_checks" ADD COLUMN     "person_dob" TEXT,
ADD COLUMN     "person_key" TEXT,
ADD COLUMN     "provider_reference" TEXT,
ADD COLUMN     "result" JSONB,
ADD COLUMN     "session_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "kyb_checks_provider_reference_key" ON "kyb_checks"("provider_reference");

