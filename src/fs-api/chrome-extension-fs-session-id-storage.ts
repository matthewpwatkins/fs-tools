import { FsSessionIdStorage } from "./fs-session-id-storage";

enum SessionType {
  ANONYMOUS = 'anonymous-fs-session-id',
  AUTHENTICATED = 'authenticated-fs-session-id'
}

type SessionCallback = (sessionId?: string) => Promise<void>;

export class ChromeExtensionFsSessionIdStorage implements FsSessionIdStorage {
  private sessionIds: Map<SessionType, string | undefined> = new Map();
  private sessionidLoadedStates: Map<SessionType, boolean> = new Map();
  private changeCallbacks: Map<SessionType, Map<string, SessionCallback>> = new Map([
    [SessionType.ANONYMOUS, new Map()],
    [SessionType.AUTHENTICATED, new Map()]
  ]);

  constructor() {
    chrome.storage.local.onChanged.addListener((changes) => {
      Object.values(SessionType).forEach(sessionType => {
        if (sessionType in changes) {
          const currentValue = this.sessionIds.get(sessionType);
          const newValue = changes[sessionType].newValue;
          if (currentValue !== newValue) {
            this.sessionIds.set(sessionType, newValue);
            this.changeCallbacks.get(sessionType)?.forEach(callback => {
              callback(newValue);
            });
          }
          this.sessionidLoadedStates.set(sessionType, true);
        }
      });
    });
  }

  // Public API methods
  public getAnonymousSessionId(): Promise<string | undefined> {
    return this.getSessionId(SessionType.ANONYMOUS);
  }

  public setAnonymousSessionId(sessionId?: string): Promise<void> {
    return this.setSessionId(SessionType.ANONYMOUS, sessionId);
  }

  public subsribeToAnonymousSessionIdChanges(subscriptionId: string, callback: SessionCallback): void {
    this.subscribeToSessionIdChanges(SessionType.ANONYMOUS, subscriptionId, callback);
  }

  public getAuthenticatedSessionId(): Promise<string | undefined> {
    return this.getSessionId(SessionType.AUTHENTICATED);
  }

  public setAuthenticatedSessionId(sessionId?: string): Promise<void> {
    return this.setSessionId(SessionType.AUTHENTICATED, sessionId);
  }

  public subsribeToAuthenticatedSessionIdChanges(subscriptionId: string, callback: SessionCallback): void {
    this.subscribeToSessionIdChanges(SessionType.AUTHENTICATED, subscriptionId, callback);
  }

  // Generic methods for handling both session types
  private async getSessionId(type: SessionType): Promise<string | undefined> {
    if (this.sessionidLoadedStates.get(type)) {
      return this.sessionIds.get(type);
    }

    const storageRecord = await chrome.storage.local.get(type);
    const sessionid = storageRecord[type];
    this.sessionIds.set(type, sessionid);
    this.sessionidLoadedStates.set(type, true);
    return sessionid;
  }

  private async setSessionId(type: SessionType, sessionId?: string): Promise<void> {
    if (sessionId) {
      await chrome.storage.local.set({ [type]: sessionId });
    } else {
      await chrome.storage.local.remove(type as string);
    }

    this.sessionIds.set(type, sessionId);
    this.sessionidLoadedStates.set(type, true);
    for (const callback of this.changeCallbacks.get(type)?.values() || []) {
      await callback(sessionId);
    }
  }

  private subscribeToSessionIdChanges(type: SessionType, subscriptionId: string, callback: SessionCallback): void {
    this.changeCallbacks.get(type)?.set(subscriptionId, callback);
  }
}