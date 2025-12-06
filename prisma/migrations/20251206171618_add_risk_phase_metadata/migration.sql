-- AlterTable
ALTER TABLE `RiskSnapshot` ADD COLUMN `adaptiveTractionAlert` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `earlyClabsiScore` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lateClabsiScore` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `riskPhase` ENUM('early', 'late') NOT NULL DEFAULT 'late',
    ADD COLUMN `trendPenalty` INTEGER NOT NULL DEFAULT 0;
