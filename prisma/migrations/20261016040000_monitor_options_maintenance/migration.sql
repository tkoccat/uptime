-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'NTFY';
ALTER TYPE "NotificationType" ADD VALUE 'PUSHOVER';
ALTER TYPE "NotificationType" ADD VALUE 'GOOGLE_CHAT';

-- AlterTable
ALTER TABLE "Monitor" ADD COLUMN "options" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "description" TEXT;

-- CreateTable
CREATE TABLE "Maintenance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MaintenanceToMonitor" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MaintenanceToMonitor_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Maintenance_userId_startsAt_idx" ON "Maintenance"("userId", "startsAt");

-- CreateIndex
CREATE INDEX "_MaintenanceToMonitor_B_index" ON "_MaintenanceToMonitor"("B");

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MaintenanceToMonitor" ADD CONSTRAINT "_MaintenanceToMonitor_A_fkey" FOREIGN KEY ("A") REFERENCES "Maintenance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MaintenanceToMonitor" ADD CONSTRAINT "_MaintenanceToMonitor_B_fkey" FOREIGN KEY ("B") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;