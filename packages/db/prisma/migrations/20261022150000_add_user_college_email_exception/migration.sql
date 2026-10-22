-- AlterTable
ALTER TABLE "users" ADD COLUMN "college_email_exception" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "exception_reason" TEXT;
