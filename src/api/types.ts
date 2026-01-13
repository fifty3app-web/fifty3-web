// src/api/types.ts

export enum Role {
  TRAINER = "TRAINER",
  CLIENT = "CLIENT",
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  active: boolean;
}

// ---------- Πληρωμές / Συνδρομή ----------

export enum PaymentStatus {
  PAID = "PAID",
  UNPAID = "UNPAID",
  LATE = "LATE",
}

export interface PaymentInfo {
  clientId: string;
  period: string; // π.χ. "2025-01"
  amount: number;
  status: PaymentStatus;
}

// ---------- Πρόγραμμα προπόνησης ----------

export interface WorkoutExercise {
  name: string;
  sets: number;
  reps: number;
  restSeconds?: number;
  notes?: string;
}

export interface WorkoutDay {
  dayOfWeek: number; // 1=Δευτέρα ... 7=Κυριακή
  exercises: WorkoutExercise[];
}

export interface WorkoutPlan {
  clientId: string;
  title: string;
  days: WorkoutDay[];
  notesForClient?: string;
  notesForTrainer?: string;
}

// ---------- Στοιχεία πελάτη ----------

export enum Gender {
  MALE = "MALE",
  FEMALE = "FEMALE",
  OTHER = "OTHER",
  UNSPECIFIED = "UNSPECIFIED",
}

export interface ClientProfile {
  clientId: string;
  phone?: string;
  dateOfBirth?: string;  // ISO "1995-05-10"
  gender: Gender;
  occupation?: string;
  goals?: string;
  medicalNotes?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  registrationDate: string; // ISO "2024-01-01"
}

// ---------- Σωματικές μετρήσεις ----------

export interface BodyMetrics {
  id: string;
  clientId: string;
  date: string; // ISO "2024-02-15"
  weightKg?: number;
  heightCm?: number;
  bodyFatPercent?: number;
  muscleMassKg?: number;
  waistCm?: number;
  hipCm?: number;
  chestCm?: number;
  notes?: string;
}

// ---------- Σημειώσεις γυμναστή ----------

export interface ClientNote {
  id: string;
  clientId: string;
  authorTrainerId: string;
  text: string;
  createdAt: string; // ISO datetime
}
