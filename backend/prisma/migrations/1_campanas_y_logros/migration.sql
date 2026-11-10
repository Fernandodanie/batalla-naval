-- AlterTable
ALTER TABLE "Match" ADD COLUMN "biome" TEXT NOT NULL DEFAULT 'water';

-- CreateTable
CREATE TABLE "CampaignProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "missionId" INTEGER NOT NULL,
    "stars" INTEGER NOT NULL,
    "bestShots" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementUnlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AchievementUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignProgress_userId_idx" ON "CampaignProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignProgress_userId_campaignId_missionId_key" ON "CampaignProgress"("userId", "campaignId", "missionId");

-- CreateIndex
CREATE INDEX "AchievementUnlock_userId_idx" ON "AchievementUnlock"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementUnlock_userId_achievementId_key" ON "AchievementUnlock"("userId", "achievementId");

-- AddForeignKey
ALTER TABLE "CampaignProgress" ADD CONSTRAINT "CampaignProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementUnlock" ADD CONSTRAINT "AchievementUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
