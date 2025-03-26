export interface FsSessionIdStorage {
  getAnonymousSessionId(): Promise<string | undefined>;
  setAnonymousSessionId(sessionId?: string): Promise<void>;
  onAnonymousSessionIdChange(callback: (sessionId: string | undefined) => void): void;

  getAuthenticatedSessionId(): Promise<string | undefined>;
  setAuthenticatedSessionId(sessionId?: string): Promise<void>;
  onAuthenticatedSessionIdChange(callback: (sessionId: string | undefined) => void): void;
}