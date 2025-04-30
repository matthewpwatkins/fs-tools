import { DataStorage, IpAddressData, Session, Version } from "./data-storage";
import { FindAGraveMemorialData } from "./models/findagrave-memorial-data";

// Define constants for magic strings
const LAST_RUN_VERSION = 'last-run-version';
const ANONYMOUS_SESSION_ID_KEY = 'anonymous-fs-session';
const AUTHENTICATED_SESSION_ID_KEY = 'authenticated-fs-session';
const ALL_SESSION_ID_KEYS = [ANONYMOUS_SESSION_ID_KEY, AUTHENTICATED_SESSION_ID_KEY];
const FIND_A_GRAVE_MEMORIAL_PREFIX = 'find-a-grave-memorial.';
const IP_ADDRESS_DATA_KEY = 'ip-address-data';

type DataCallback<T> = (value?: T) => Promise<void>;

export class ChromeExtensionDataStorage implements DataStorage {
  private sessionCache: Map<string, Session | undefined> = new Map();
  private sessionCallbacks: Map<string, Map<string, DataCallback<Session>>> = new Map();

  constructor() {
    chrome.storage.local.onChanged.addListener((changes) => {
      for (const key of ALL_SESSION_ID_KEYS) {
        if (changes[key]) {
          const updatedSession = changes[key]?.newValue ? JSON.parse(changes[key].newValue) as Session : undefined;
          this.sessionCache.set(key, updatedSession);
          this.sessionCallbacks.get(key)?.forEach(callback => {
            callback(updatedSession);
          });
        }
      }
    });
  }

  public async getLastRunVersion(): Promise<Version | undefined> {
    return await this.getObject<Version>(LAST_RUN_VERSION);
  }

  public async setLastRunVersion(version: Version): Promise<void> {
    await this.setObject(LAST_RUN_VERSION, version);
  }

  public async clear(): Promise<void> {
    await chrome.storage.local.clear();
    this.sessionCache.clear();
    this.sessionCallbacks.clear();
  }

  // Anonymous session ID
  public async getAnonymousSession(): Promise<Session | undefined> {
    if (this.sessionCache.has(ANONYMOUS_SESSION_ID_KEY)) {
      return this.sessionCache.get(ANONYMOUS_SESSION_ID_KEY);
    }
    const session = await this.getObject<Session>(ANONYMOUS_SESSION_ID_KEY);
    this.sessionCache.set(ANONYMOUS_SESSION_ID_KEY, session);
    return session;
  }

  public async setAnonymousSession(session?: Session): Promise<void> {
    await this.setObject(ANONYMOUS_SESSION_ID_KEY, session);
    this.sessionCache.set(ANONYMOUS_SESSION_ID_KEY, session);
  }

  public subsribeToAnonymousSessionChanges(subscriptionId: string, callback: (session?: Session) => Promise<void>): void {
    this.subscribeToSessionChange(ANONYMOUS_SESSION_ID_KEY, subscriptionId, callback);
  }

  // Authenticated session ID
  public async getAuthenticatedSession(): Promise<Session | undefined> {
    if (this.sessionCache.has(AUTHENTICATED_SESSION_ID_KEY)) {
      return this.sessionCache.get(AUTHENTICATED_SESSION_ID_KEY);
    }
    const session = await this.getObject<Session>(AUTHENTICATED_SESSION_ID_KEY);
    this.sessionCache.set(AUTHENTICATED_SESSION_ID_KEY, session);
    return session;
  }

  public async setAuthenticatedSession(session?: Session): Promise<void> {
    await this.setObject(AUTHENTICATED_SESSION_ID_KEY, session);
    this.sessionCache.set(AUTHENTICATED_SESSION_ID_KEY, session);
  }

  public subsribeToAuthenticatedSessionChanges(subscriptionId: string, callback: (session?: Session) => Promise<void>): void {
    this.subscribeToSessionChange(AUTHENTICATED_SESSION_ID_KEY, subscriptionId, callback);
  }

  // FindAGrave Memorial data
  public async getFindAGraveMemorialData(memorialId: string): Promise<FindAGraveMemorialData | undefined> {
    return await this.getObject<FindAGraveMemorialData>(`${FIND_A_GRAVE_MEMORIAL_PREFIX}${memorialId}`);
  }

  public async setFindAGraveMemorialData(memorialId: string, data: FindAGraveMemorialData | undefined): Promise<void> {
    await this.setObject(`${FIND_A_GRAVE_MEMORIAL_PREFIX}${memorialId}`, data);
  }

  // IP Address data
  public async getIpAddressData(): Promise<IpAddressData | undefined> {
    return await this.getObject<IpAddressData>(IP_ADDRESS_DATA_KEY);
  }

  public async setIpAddressData(data: IpAddressData): Promise<void> {
    await this.setObject(IP_ADDRESS_DATA_KEY, data);
  }

  // #region Private helpers

  private async getObject<T>(key: string): Promise<T | undefined> {
    const stringValue = await this.getString(key);
    return stringValue ? JSON.parse(stringValue) : undefined;
  }

  private async getString(key: string): Promise<string | undefined> {
    return (await chrome.storage.local.get(key))[key];
  }

  private async setObject<T>(key: string, value: T | undefined): Promise<void> {
    await this.setString(key, value ? JSON.stringify(value) : undefined);
  }

  private async setString(key: string, value?: string): Promise<void> {
    if (value) {
      await chrome.storage.local.set({ [key]: value });
    } else {
      await chrome.storage.local.remove(key);
    }
  }

  private subscribeToSessionChange(key: string, subscriptionId: string, callback: DataCallback<Session>): void {
    if (!this.sessionCallbacks.has(key)) {
      this.sessionCallbacks.set(key, new Map());
    }
    this.sessionCallbacks.get(key)!.set(subscriptionId, callback);
  }

  // #endregion
}