-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('INSPECTOR', 'OPERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "MachineType" AS ENUM ('VMM', 'CMM');

-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('ACTIVE', 'IDLE', 'MAINTENANCE', 'SHUTDOWN');

-- CreateEnum
CREATE TYPE "PartStatus" AS ENUM ('PENDING', 'QUEUED', 'IN_INSPECTION', 'ACCEPTED', 'REJECTED', 'FOR_REVIEW', 'SCRAPPED');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "QADecision" AS ENUM ('APPROVED', 'OVERRIDE_ACCEPT', 'OVERRIDE_REJECT', 'RE_INSPECT');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "QueueItemStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'INSPECTOR',
    "department" TEXT,
    "position" TEXT,
    "accountId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MachineType" NOT NULL,
    "status" "MachineStatus" NOT NULL DEFAULT 'ACTIVE',
    "location" TEXT,
    "specifications" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "status" "PartStatus" NOT NULL DEFAULT 'PENDING',
    "currentMachineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "result" "InspectionResult" NOT NULL,
    "measurements" JSONB,
    "notes" TEXT,
    "qaReviewerId" TEXT,
    "qaDecision" "QADecision",
    "qaJustification" TEXT,
    "qaReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionQueue" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "position" INTEGER NOT NULL DEFAULT 0,
    "estimatedTime" INTEGER NOT NULL DEFAULT 15,
    "status" "QueueItemStatus" NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineReport" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShutdownEvent" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),

    CONSTRAINT "ShutdownEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GAConfiguration" (
    "id" TEXT NOT NULL,
    "populationSize" INTEGER NOT NULL DEFAULT 50,
    "generations" INTEGER NOT NULL DEFAULT 100,
    "crossoverRate" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "mutationRate" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "elitismCount" INTEGER NOT NULL DEFAULT 2,
    "waitTimeWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "utilizationWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "priorityWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GAConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_accountId_key" ON "User"("accountId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_accountId_idx" ON "User"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Machine_name_key" ON "Machine"("name");

-- CreateIndex
CREATE INDEX "Machine_status_idx" ON "Machine"("status");

-- CreateIndex
CREATE INDEX "Machine_type_idx" ON "Machine"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Part_partNumber_key" ON "Part"("partNumber");

-- CreateIndex
CREATE INDEX "Part_status_idx" ON "Part"("status");

-- CreateIndex
CREATE INDEX "Part_partNumber_idx" ON "Part"("partNumber");

-- CreateIndex
CREATE INDEX "Inspection_partId_idx" ON "Inspection"("partId");

-- CreateIndex
CREATE INDEX "Inspection_inspectorId_idx" ON "Inspection"("inspectorId");

-- CreateIndex
CREATE INDEX "Inspection_machineId_idx" ON "Inspection"("machineId");

-- CreateIndex
CREATE INDEX "Inspection_result_idx" ON "Inspection"("result");

-- CreateIndex
CREATE INDEX "Inspection_createdAt_idx" ON "Inspection"("createdAt");

-- CreateIndex
CREATE INDEX "InspectionQueue_machineId_idx" ON "InspectionQueue"("machineId");

-- CreateIndex
CREATE INDEX "InspectionQueue_status_idx" ON "InspectionQueue"("status");

-- CreateIndex
CREATE INDEX "InspectionQueue_priority_idx" ON "InspectionQueue"("priority");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "MachineReport_machineId_idx" ON "MachineReport"("machineId");

-- CreateIndex
CREATE INDEX "MachineReport_createdAt_idx" ON "MachineReport"("createdAt");

-- CreateIndex
CREATE INDEX "ShutdownEvent_machineId_idx" ON "ShutdownEvent"("machineId");

-- CreateIndex
CREATE INDEX "ShutdownEvent_startTime_idx" ON "ShutdownEvent"("startTime");

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_qaReviewerId_fkey" FOREIGN KEY ("qaReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionQueue" ADD CONSTRAINT "InspectionQueue_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionQueue" ADD CONSTRAINT "InspectionQueue_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineReport" ADD CONSTRAINT "MachineReport_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineReport" ADD CONSTRAINT "MachineReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShutdownEvent" ADD CONSTRAINT "ShutdownEvent_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShutdownEvent" ADD CONSTRAINT "ShutdownEvent_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GAConfiguration" ADD CONSTRAINT "GAConfiguration_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
