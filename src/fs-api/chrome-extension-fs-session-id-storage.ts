export class ChromeExtensionFsSessionIdStorage {
  private static readonly SESSION_ID_STORAGE_KEY = 'fs-session-id';

  async getSessionId(): Promise<string | undefined> {
    return new Promise((resolve) => {
      chrome.storage.local.get([ChromeExtensionFsSessionIdStorage.SESSION_ID_STORAGE_KEY], (result) => {
        resolve(result[ChromeExtensionFsSessionIdStorage.SESSION_ID_STORAGE_KEY]);
      });
    });
  }

  async setSessionId(sessionId: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [ChromeExtensionFsSessionIdStorage.SESSION_ID_STORAGE_KEY]: sessionId }, () => {
        resolve();
      });
    });
  }
}