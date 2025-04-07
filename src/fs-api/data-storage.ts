import { FindAGraveMemorialData } from "../models/findagrave-memorial-data";

export interface DataStorage {
  getLatestStrageVersionId(): Promise<string | undefined>;
  setLatestStrageVersionId(versionId: string): Promise<void>;
  clear(): Promise<void>;

  // Anonymous session ID
  getAnonymousSessionId(): Promise<string | undefined>;
  setAnonymousSessionId(sessionId?: string): Promise<void>;
  subsribeToAnonymousSessionIdChanges(subscriptionId: string, callback: (sessionId?: string) => Promise<void>): void;

  // Authenticated session ID
  getAuthenticatedSessionId(): Promise<string | undefined>;
  setAuthenticatedSessionId(sessionId?: string): Promise<void>;
  subsribeToAuthenticatedSessionIdChanges(subscriptionId: string, callback: (sessionId?: string) => Promise<void>): void;

  // Memorial data (record and person IDs)
  getFindAGraveMemorialData(memorialId: string): Promise<FindAGraveMemorialData | undefined>;
  setFindAGraveMemorialData(memorialId: string, data: FindAGraveMemorialData | undefined): Promise<void>;
}