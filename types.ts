export interface User {
  id: string;
  email?: string;
  username: string;
  full_name?: string;
  role: 'grand_admin' | 'master_admin' | 'admin' | 'user';
}

export interface ChatMessage {
  id: string;
  user_id: string;
  username: string; // Display name
  content: string;
  created_at: string;
  role?: string; // Optional role for styling
}

export enum RoutePath {
  LOGIN = '/login',
  DASHBOARD = '/',
  CHAT = '/chat',
  DEAD_DROP = '/dead-drop',
  USERS = '/users'
}

export interface FormSubmission {
  id: string;
  source: string;
  timestamp: string;
  status: 'processed' | 'pending' | 'flagged';
  ipAddress: string;
  payload: Record<string, any>;
  mapped_data?: Record<string, any>;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  type?: 'credential' | 'form';
}

export interface StoredCredential {
  id: string;
  clientName: string;
  serviceName: string; // CRM Name
  crmLink: string;
  username: string; // Login Email
  password: string;
  lastUpdated: Date;
  folderId: string | null;
}