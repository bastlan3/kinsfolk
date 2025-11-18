export enum View {
  DASHBOARD = 'DASHBOARD',
  CAPSULE = 'CAPSULE',
  STUDIO = 'STUDIO',
  CHAT = 'CHAT',
  FAMILY = 'FAMILY'
}

export interface Photo {
  id: string;
  url: string;
  caption?: string;
  dateAdded: number;
  author: string;
  isGenerated?: boolean;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  status: 'ready' | 'pending' | 'overdue';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface CapsuleStats {
  streak: number;
  nextUnlock: number;
  totalPhotos: number;
  treeLevel: number; // 1-5
}