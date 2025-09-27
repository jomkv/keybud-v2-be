-- CreateEnum
CREATE TYPE "public"."SwitchType" AS ENUM ('CLICKY', 'TACTILE', 'LINEAR');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "googleId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "switchType" "public"."SwitchType",

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserSetting" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "muteAllNotifs" BOOLEAN NOT NULL DEFAULT false,
    "messagesNotif" BOOLEAN NOT NULL DEFAULT false,
    "followersNotif" BOOLEAN NOT NULL DEFAULT false,
    "starsNotif" BOOLEAN NOT NULL DEFAULT false,
    "repostsNotif" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserFollow" (
    "id" SERIAL NOT NULL,
    "followerUserId" INTEGER NOT NULL,
    "followingUserId" INTEGER NOT NULL,

    CONSTRAINT "UserFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Status" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edittedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Attachment" (
    "id" SERIAL NOT NULL,
    "statusId" INTEGER NOT NULL,
    "publicId" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StatusStar" (
    "id" SERIAL NOT NULL,
    "statusId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "StatusStar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StatusRepost" (
    "id" SERIAL NOT NULL,
    "statusId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "StatusRepost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "public"."User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSetting_userId_key" ON "public"."UserSetting"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_publicId_key" ON "public"."Attachment"("publicId");

-- AddForeignKey
ALTER TABLE "public"."UserSetting" ADD CONSTRAINT "UserSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserFollow" ADD CONSTRAINT "UserFollow_followerUserId_fkey" FOREIGN KEY ("followerUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserFollow" ADD CONSTRAINT "UserFollow_followingUserId_fkey" FOREIGN KEY ("followingUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Status" ADD CONSTRAINT "Status_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Status" ADD CONSTRAINT "Status_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attachment" ADD CONSTRAINT "Attachment_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."Status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StatusStar" ADD CONSTRAINT "StatusStar_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."Status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StatusStar" ADD CONSTRAINT "StatusStar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StatusRepost" ADD CONSTRAINT "StatusRepost_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."Status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StatusRepost" ADD CONSTRAINT "StatusRepost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
