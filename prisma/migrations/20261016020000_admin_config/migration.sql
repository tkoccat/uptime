-- AlterTable
ALTER TABLE "User" ADD COLUMN     "planLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "PlanConfig" (
    "plan" "Plan" NOT NULL,
    "priceMonthly" INTEGER NOT NULL,
    "priceYearly" INTEGER NOT NULL,
    "eurMonthly" INTEGER,
    "eurYearly" INTEGER,
    "usdMonthly" INTEGER,
    "usdYearly" INTEGER,
    "monitors" INTEGER NOT NULL,
    "minInterval" INTEGER NOT NULL,
    "statusPages" INTEGER NOT NULL,
    "customDomain" BOOLEAN NOT NULL,
    "api" BOOLEAN NOT NULL,
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stripeProductId" TEXT,
    "stripePriceMonthly" TEXT,
    "stripePriceYearly" TEXT,
    "stripePriceHistory" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanConfig_pkey" PRIMARY KEY ("plan")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SiteContent" (
    "key" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("key","locale")
);

