export class TampermonkeyFsSessionIdStorage {
  private static readonly SESSION_ID_STORAGE_KEY = 'fs-session-id';

  async getSessionId(): Promise<string | undefined> {
      return GM.getValue(TampermonkeyFsSessionIdStorage.SESSION_ID_STORAGE_KEY);
  }
  async setSessionId(sessionId: string): Promise<void> {
      return GM.setValue(TampermonkeyFsSessionIdStorage.SESSION_ID_STORAGE_KEY, sessionId);
  }
}