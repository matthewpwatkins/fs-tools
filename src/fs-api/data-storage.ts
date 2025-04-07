export interface DataStorage {
  // Anonymous session ID
  getAnonymousSessionId(): Promise<string | undefined>;
  setAnonymousSessionId(sessionId?: string): Promise<void>;
  subsribeToAnonymousSessionIdChanges(subscriptionId: string, callback: (sessionId?: string) => Promise<void>): void;

  // Authenticated session ID
  getAuthenticatedSessionId(): Promise<string | undefined>;
  setAuthenticatedSessionId(sessionId?: string): Promise<void>;
  subsribeToAuthenticatedSessionIdChanges(subscriptionId: string, callback: (sessionId?: string) => Promise<void>): void;

  // Memorial record and person IDs
  getMemorialRecordId(memorialId: string): Promise<string | undefined>;
  setMemorialRecordId(memorialId: string, recordId: string | undefined): Promise<void>;

  getMemorialPersonId(memorialId: string): Promise<string | undefined>;
  setMemorialPersonId(memorialId: string, personId: string | undefined): Promise<void>;
}