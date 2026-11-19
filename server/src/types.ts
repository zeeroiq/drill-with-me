export interface AdminSession {
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      visitorId?: string;
      clientIp?: string;
      admin?: AdminSession;
    }
  }
}
