export type Role = 'superadmin' | 'admin' | 'voluntario';
export type Status = 'PENDING' | 'APPROVED' | 'REJECTED';
export type Priority = 'baixa' | 'media' | 'alta';
export type DemandStatus = 'pendente' | 'em_andamento' | 'concluida';

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  status: Status;
  created_at: string;
  updated_at: string;
}

export interface Point {
  id: string;
  name: string;
  active: boolean;
  notes?: string;
  created_at: string;
}

export interface Person {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CensusEntry {
  id: string;
  mission_day: string;
  point_id: string;
  count: number;
  recorded_by: string;
  error_report?: string;
  clothes_kits_count?: number;
  food_kits_count?: number;
  created_at: string;
}

export interface KitOutflow {
  id: string;
  mission_day: string;
  point_id: string;
  food_kits: number;
  clothing_kits: number;
  recorded_by: string;
  created_at: string;
  point?: Point;
}

export interface Demand {
  id: string;
  person_id: string;
  point_id: string;
  description: string;
  priority: Priority;
  status: DemandStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  person?: Person;
  point?: Point;
}

export interface ClinicRecord {
  id: string;
  person_id: string;
  observation: string;
  created_by: string;
  created_at: string;
  person?: Person;
}

export interface AppSetting {
  key: string;
  value: any;
  updated_at: string;
}

export interface MissionLink {
  id: string;
  mission_day: string;
  title: string;
  url: string;
  created_at: string;
}

export interface DailyVerse {
  day: string;
  reference: string;
  text: string;
}

export interface MissionEvent {
  id: string;
  mission_date: string;
  title: string;
  notes?: string;
  created_at: string;
}

export interface AppEvent {
  id: string;
  title: string;
  description: string;
  event_date: string;
  photos_url?: string;
  created_by: string;
  created_at: string;
}