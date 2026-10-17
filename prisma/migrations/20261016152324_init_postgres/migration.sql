-- CreateTable
CREATE TABLE "Ward" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wardType" TEXT NOT NULL,
    "aliases" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "Ward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organism" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "orgClass" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "aliases" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "Organism_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drug" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "drugClass" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "aliases" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "Drug_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Isolate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hn" TEXT NOT NULL,
    "sex" TEXT,
    "patientType" TEXT,
    "wardId" INTEGER,
    "labNo" TEXT,
    "orderNo" TEXT,
    "specimenDate" TIMESTAMP(3) NOT NULL,
    "specimenType" TEXT NOT NULL,
    "specimenDetail" TEXT,
    "organismId" INTEGER NOT NULL,
    "reportStatus" TEXT NOT NULL DEFAULT 'FINAL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL,
    "needsReview" TEXT NOT NULL DEFAULT '[]',
    "phenotypes" TEXT NOT NULL DEFAULT '[]',
    "labComments" TEXT,
    "sourceFile" TEXT,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Isolate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AstResult" (
    "isolateId" TEXT NOT NULL,
    "drugId" INTEGER NOT NULL,
    "result" TEXT NOT NULL,

    CONSTRAINT "AstResult_pkey" PRIMARY KEY ("isolateId","drugId")
);

-- CreateTable
CREATE TABLE "AiConsultLog" (
    "id" SERIAL NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "toolResults" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "verify" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,

    CONSTRAINT "AiConsultLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ward_code_key" ON "Ward"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Organism_name_key" ON "Organism"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Drug_name_key" ON "Drug"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Isolate_code_key" ON "Isolate"("code");

-- CreateIndex
CREATE INDEX "Isolate_hn_organismId_specimenDate_idx" ON "Isolate"("hn", "organismId", "specimenDate");

-- CreateIndex
CREATE INDEX "Isolate_status_specimenDate_idx" ON "Isolate"("status", "specimenDate");

-- AddForeignKey
ALTER TABLE "Isolate" ADD CONSTRAINT "Isolate_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Isolate" ADD CONSTRAINT "Isolate_organismId_fkey" FOREIGN KEY ("organismId") REFERENCES "Organism"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AstResult" ADD CONSTRAINT "AstResult_isolateId_fkey" FOREIGN KEY ("isolateId") REFERENCES "Isolate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AstResult" ADD CONSTRAINT "AstResult_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
