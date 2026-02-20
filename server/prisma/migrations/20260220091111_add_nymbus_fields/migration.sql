-- AlterTable: add nymbusCustomerId to User
ALTER TABLE "User" ADD COLUMN "nymbusCustomerId" TEXT;
CREATE UNIQUE INDEX "User_nymbusCustomerId_key" ON "User"("nymbusCustomerId");

-- AlterTable: add nymbusAccountId to Account
ALTER TABLE "Account" ADD COLUMN "nymbusAccountId" TEXT;
CREATE UNIQUE INDEX "Account_nymbusAccountId_key" ON "Account"("nymbusAccountId");

-- AlterTable: add nymbusTransferId to Transaction
ALTER TABLE "Transaction" ADD COLUMN "nymbusTransferId" TEXT;
