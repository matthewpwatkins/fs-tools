import { FsSessionIdStorage } from "./fs-session-id-storage";

export class ChromeExtensionFsSessionIdStorage implements FsSessionIdStorage {
  private static readonly ANONYMOUS_SESSION_ID_STORAGE_KEY = 'anonymous-fs-session-id';
  private static readonly AUTHENTICATED_SESSION_ID_STORAGE_KEY = 'authenticated-fs-session-id';
  
  getAnonymousSessionId(): Promise<string | undefined> {
    return new Promise((resolve) => {
      chrome.storage.local.get([ChromeExtensionFsSessionIdStorage.ANONYMOUS_SESSION_ID_STORAGE_KEY], (result) => {
        resolve(result[ChromeExtensionFsSessionIdStorage.ANONYMOUS_SESSION_ID_STORAGE_KEY]);
      });
    });
  }

  setAnonymousSessionId(sessionId?: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [ChromeExtensionFsSessionIdStorage.ANONYMOUS_SESSION_ID_STORAGE_KEY]: sessionId }, () => {
        resolve();
      });
    });
  }

  onAnonymousSessionIdChange(callback: (sessionId: string | undefined) => void): void {
    chrome.storage.local.onChanged.addListener((changes) => {
      if (ChromeExtensionFsSessionIdStorage.ANONYMOUS_SESSION_ID_STORAGE_KEY in changes) {
        callback(changes[ChromeExtensionFsSessionIdStorage.ANONYMOUS_SESSION_ID_STORAGE_KEY].newValue);
      }
    })
  }

  getAuthenticatedSessionId(): Promise<string | undefined> {
    return new Promise((resolve) => {
      chrome.storage.local.get([ChromeExtensionFsSessionIdStorage.AUTHENTICATED_SESSION_ID_STORAGE_KEY], (result) => {
        resolve(result[ChromeExtensionFsSessionIdStorage.AUTHENTICATED_SESSION_ID_STORAGE_KEY]);
      });
    });
  }

  setAuthenticatedSessionId(sessionId?: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [ChromeExtensionFsSessionIdStorage.AUTHENTICATED_SESSION_ID_STORAGE_KEY]: sessionId }, () => {
        resolve();
      });
    });
  }

  onAuthenticatedSessionIdChange(callback: (sessionId: string | undefined) => void): void {
    chrome.storage.local.onChanged.addListener((changes) => {
      if (ChromeExtensionFsSessionIdStorage.AUTHENTICATED_SESSION_ID_STORAGE_KEY in changes) {
        callback(changes[ChromeExtensionFsSessionIdStorage.AUTHENTICATED_SESSION_ID_STORAGE_KEY].newValue);
      }
    })
  }
}