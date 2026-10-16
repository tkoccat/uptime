-- AlterEnum
ALTER TYPE "MonitorType" ADD VALUE 'HEARTBEAT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'DISCORD';
ALTER TYPE "NotificationType" ADD VALUE 'TELEGRAM';
ALTER TYPE "NotificationType" ADD VALUE 'TEAMS';

-- AlterTable
ALTER TABLE "Monitor" ADD COLUMN     "graceSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastPingAt" TIMESTAMP(3),
ADD COLUMN     "pingToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Monitor_pingToken_key" ON "Monitor"("pingToken");

