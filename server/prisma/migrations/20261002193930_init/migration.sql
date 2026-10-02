-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "dailyRateCents" INTEGER NOT NULL,
    "plate" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Renter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "renterId" TEXT,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "dailyRateCents" INTEGER NOT NULL,
    "coverageDailyCents" INTEGER NOT NULL DEFAULT 0,
    "coverageEndsAt" DATETIME,
    CONSTRAINT "Booking_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_renterId_fkey" FOREIGN KEY ("renterId") REFERENCES "Renter" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "renterId" TEXT NOT NULL,
    "bookingId" TEXT,
    "direction" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_renterId_fkey" FOREIGN KEY ("renterId") REFERENCES "Renter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtensionRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "parsedJson" TEXT,
    "originalEndAt" DATETIME NOT NULL,
    "interpretedEndAt" DATETIME,
    "interpretationNote" TEXT,
    "status" TEXT NOT NULL,
    "optionsJson" TEXT,
    "chosenOptionType" TEXT,
    "chosenEndAt" DATETIME,
    "declineReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    CONSTRAINT "ExtensionRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExtensionRequest_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "extensionRequestId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "providerRef" TEXT NOT NULL,
    CONSTRAINT "Charge_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Charge_extensionRequestId_fkey" FOREIGN KEY ("extensionRequestId") REFERENCES "ExtensionRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "extensionRequestId" TEXT,
    "bookingId" TEXT,
    "type" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_extensionRequestId_fkey" FOREIGN KEY ("extensionRequestId") REFERENCES "ExtensionRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ExtensionRequest_messageId_key" ON "ExtensionRequest"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "Charge_extensionRequestId_key" ON "Charge"("extensionRequestId");
