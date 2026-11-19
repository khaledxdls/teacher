-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "syncVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRecord" (
    "userId" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL,

    CONSTRAINT "SyncRecord_pkey" PRIMARY KEY ("userId","collection","id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "SyncRecord_userId_version_idx" ON "SyncRecord"("userId", "version");

-- AddForeignKey
ALTER TABLE "SyncRecord" ADD CONSTRAINT "SyncRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
