-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Renter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'DEMO'
);
INSERT INTO "new_Renter" ("id", "name", "phone") SELECT "id", "name", "phone" FROM "Renter";
DROP TABLE "Renter";
ALTER TABLE "new_Renter" RENAME TO "Renter";
CREATE TABLE "new_Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "dailyRateCents" INTEGER NOT NULL,
    "plate" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'DEMO'
);
INSERT INTO "new_Vehicle" ("category", "dailyRateCents", "id", "name", "plate", "seats") SELECT "category", "dailyRateCents", "id", "name", "plate", "seats" FROM "Vehicle";
DROP TABLE "Vehicle";
ALTER TABLE "new_Vehicle" RENAME TO "Vehicle";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
