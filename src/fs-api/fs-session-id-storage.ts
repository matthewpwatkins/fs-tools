export interface FsSessionIdStorage {
  getAnonymousSessionId(): Promise<string | undefined>;
  setAnonymousSessionId(sessionId?: string): Promise<void>;
  subsribeToAnonymousSessionIdChanges(subscriptionId: string, callback: (sessionId?: string) => Promise<void>): void;

  getAuthenticatedSessionId(): Promise<string | undefined>;
  setAuthenticatedSessionId(sessionId?: string): Promise<void>;
  subsribeToAuthenticatedSessionIdChanges(subscriptionId: string, callback: (sessionId?: string) => Promise<void>): void;
}