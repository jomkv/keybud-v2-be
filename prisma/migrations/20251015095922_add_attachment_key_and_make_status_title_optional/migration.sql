/*
  Warnings:

  - You are about to drop the column `publicId` on the `Attachment` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `Attachment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[key]` on the table `Attachment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `key` to the `Attachment` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Attachment_publicId_key";

-- AlterTable
ALTER TABLE "public"."Attachment" DROP COLUMN "publicId",
DROP COLUMN "url",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "key" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Status" ALTER COLUMN "title" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_key_key" ON "public"."Attachment"("key");
