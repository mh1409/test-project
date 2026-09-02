import type { Request } from 'express';
import type { Permission } from '@souq/types';

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  permissions: Permission[];
  sellerId?: string | null;
  sessionId: string;
  impersonatorId?: string;
  locale: string;
}

export interface AppRequest extends Request {
  user?: AuthUser;
  requestId: string;
  anonymousId?: string;
  locale: 'ar' | 'en';
  rawBody?: Buffer;
}
