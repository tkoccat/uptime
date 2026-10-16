-- AlterTable
ALTER TABLE "Monitor" ADD COLUMN "certExpiresAt" TIMESTAMP(3),
ADD COLUMN "domainExpiresAt" TIMESTAMP(3),
ADD COLUMN "expiryCheckedAt" TIMESTAMP(3);