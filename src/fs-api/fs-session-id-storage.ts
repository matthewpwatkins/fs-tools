export interface FsSessionIdStorage {
  getSessionId(): Promise<string | undefined>;
  setSessionId(sessionId: string): Promise<void>;
}