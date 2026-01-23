-- AlterTable
ALTER TABLE "User" ADD COLUMN "stripeAccountId" TEXT,
ADD COLUMN "stripeOnboarded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "stripeTransferId" TEXT;
