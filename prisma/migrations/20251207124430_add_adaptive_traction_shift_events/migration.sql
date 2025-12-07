-- AlterTable
ALTER TABLE `RiskSnapshot` ADD COLUMN `shiftEventsId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ShiftEvents` ADD COLUMN `adaptiveTractionAlert` BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE `RiskSnapshot` ADD CONSTRAINT `RiskSnapshot_shiftEventsId_fkey` FOREIGN KEY (`shiftEventsId`) REFERENCES `ShiftEvents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
