/*
  Warnings:

  - The primary key for the `Store` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "public"."BusinessHours" DROP CONSTRAINT "BusinessHours_storeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StoreStatus" DROP CONSTRAINT "StoreStatus_storeId_fkey";

-- AlterTable
ALTER TABLE "public"."BusinessHours" ALTER COLUMN "storeId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "public"."Store" DROP CONSTRAINT "Store_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Store_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."StoreStatus" ALTER COLUMN "storeId" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "public"."BusinessHours" ADD CONSTRAINT "BusinessHours_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "public"."Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreStatus" ADD CONSTRAINT "StoreStatus_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "public"."Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
