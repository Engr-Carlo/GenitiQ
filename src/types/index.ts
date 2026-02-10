// ============================================================
// QMS Type Definitions — aligned with prisma/schema.prisma
// ============================================================

export enum UserRole {
  INSPECTOR = "INSPECTOR",
  OPERATOR = "OPERATOR",
  QA_QC = "QA_QC",
  ADMIN = "ADMIN",
}

export enum MachineType {
  VMM = "VMM",
  CMM = "CMM",
}

export enum MachineStatus {
  ACTIVE = "ACTIVE",
  IDLE = "IDLE",
  MAINTENANCE = "MAINTENANCE",
  SHUTDOWN = "SHUTDOWN",
}

export enum PartStatus {
  PENDING = "PENDING",
  QUEUED = "QUEUED",
  IN_INSPECTION = "IN_INSPECTION",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  FOR_REVIEW = "FOR_REVIEW",
  SCRAPPED = "SCRAPPED",
}

export enum InspectionResult {
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
}

export enum QADecision {
  APPROVED = "APPROVED",
  OVERRIDE_ACCEPT = "OVERRIDE_ACCEPT",
  OVERRIDE_REJECT = "OVERRIDE_REJECT",
  RE_INSPECT = "RE_INSPECT",
}

export enum Priority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export enum QueueItemStatus {
  WAITING = "WAITING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  SKIPPED = "SKIPPED",
}

// ============================================================
// User Types
// ============================================================

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: string | null;
  position: string | null;
  accountId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  department?: string;
  position?: string;
}

// ============================================================
// Machine Types
// ============================================================

export interface Machine {
  id: string;
  name: string;
  type: MachineType;
  status: MachineStatus;
  location: string | null;
  specifications: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Part Types
// ============================================================

export interface Part {
  id: string;
  partNumber: string;
  name: string | null;
  description: string | null;
  status: PartStatus;
  currentMachineId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Inspection Types
// ============================================================

export interface Inspection {
  id: string;
  partId: string;
  part?: Part;
  inspectorId: string;
  inspector?: User;
  machineId: string;
  machine?: Machine;
  result: InspectionResult;
  measurements: Record<string, unknown> | null;
  notes: string | null;
  qaReviewerId: string | null;
  qaReviewer?: User | null;
  qaDecision: QADecision | null;
  qaJustification: string | null;
  qaReviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Queue Types
// ============================================================

export interface InspectionQueue {
  id: string;
  partId: string;
  part?: Part;
  machineId: string;
  machine?: Machine;
  priority: Priority;
  position: number;
  estimatedTime: number;
  status: QueueItemStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Audit Log Types
// ============================================================

export interface AuditLog {
  id: string;
  userId: string;
  user?: User;
  action: string;
  details: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// ============================================================
// Machine Report Types
// ============================================================

export interface MachineReport {
  id: string;
  machineId: string;
  machine?: Machine;
  reportedById: string;
  reportedBy?: User;
  reason: string;
  status: string;
  createdAt: Date;
}

// ============================================================
// Shutdown Event Types
// ============================================================

export interface ShutdownEvent {
  id: string;
  machineId: string;
  machine?: Machine;
  reason: string;
  initiatedBy: string;
  startTime: Date;
  endTime: Date | null;
}

// ============================================================
// GA Configuration Types
// ============================================================

export interface GAConfiguration {
  id: string;
  populationSize: number;
  generations: number;
  crossoverRate: number;
  mutationRate: number;
  elitismCount: number;
  waitTimeWeight: number;
  utilizationWeight: number;
  priorityWeight: number;
  isActive: boolean;
  updatedById: string | null;
  updatedBy?: User | null;
  updatedAt: Date;
  createdAt: Date;
}

// ============================================================
// Dashboard / Analytics Types
// ============================================================

export interface KPIData {
  defectRate: number;
  queueRate: number;
  overallYield: number;
  scrapRate: number;
  completeYield: number;
}

export interface TrendDataPoint {
  label: string;
  value: number;
}

export interface DefectsByInspection {
  incoming: number;
  inProcess: number;
  final: number;
}

export interface InspectionResultRow {
  partNumber: string;
  status: string;
  result: string;
  machineType: MachineType;
  inspector: string;
  action: string;
  queueTime: string;
}

// ============================================================
// API Response Types
// ============================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
