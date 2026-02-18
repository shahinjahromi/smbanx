-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "moovPaymentMethodId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "moovTransferId" TEXT,
ADD COLUMN     "provider" TEXT;
