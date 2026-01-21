export interface User {
  id: string;
  email?: string;
  username: string;
  full_name?: string;
  role: 'grand_admin' | 'master_admin' | 'admin' | 'user';
  last_seen?: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  full_name?: string;
  content: string;
  created_at: string;
  updated_at?: string;
  role?: string;
  last_seen?: string;
  seen_by?: string[];
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

export interface CreatorProfile {
  username?: string;
  full_name?: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  type?: 'credential' | 'form';
  createdBy?: CreatorProfile;
}

export interface StoredCredential {
  id: string;
  clientName: string;
  serviceName: string; 
  crmLink: string;
  username: string; 
  password: string;
  lastUpdated: Date;
  folderId: string | null;
  createdAt?: string;
  createdBy?: CreatorProfile;
}

export interface FormDefinition {
    id: string;
    name: string;
    folderId: string | null;
    webhookKey: string; 
    webhookUrl: string;
    fields: any[];
    createdAt: string;
    status: 'draft' | 'active'; 
    createdBy?: CreatorProfile;
}

export interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'mention', title?: string) => void;
}