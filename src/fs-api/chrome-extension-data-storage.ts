import { DataStorage } from "./data-storage";
import { FindAGraveMemorialData } from "../models/findagrave-memorial-data";

// Define constants for magic strings
const LATEST_STORAGE_VERSION_ID_KEY = 'latest-storage-version-id';
const ANONYMOUS_SESSION_ID_KEY = 'anonymous-fs-session-id';
const AUTHENTICATED_SESSION_ID_KEY = 'authenticated-fs-session-id';
const ALL_SESSION_ID_KEYS = [ANONYMOUS_SESSION_ID_KEY, AUTHENTICATED_SESSION_ID_KEY];
const FIND_A_GRAVE_MEMORIAL_PREFIX = 'find-a-grave-memorial.';

type DataCallback<T> = (value?: T) => Promise<void>;

export class ChromeExtensionDataStorage implements DataStorage {
  private sessionIdCache: Map<string, string | undefined> = new Map();
  private sessionIdCallbacks: Map<string, Map<string, DataCallback<any>>> = new Map();

  constructor() {
    chrome.storage.local.onChanged.addListener((changes) => {
      for (const key of ALL_SESSION_ID_KEYS) {
        if (changes[key]) {
          const { newValue } = changes[key];
          this.sessionIdCache.set(key, newValue);
          this.sessionIdCallbacks.get(key)?.forEach(callback => {
            callback(newValue);
          });
        }
      }
    });
  }

  public async getLatestStrageVersionId(): Promise<string | undefined> {
    return (await chrome.storage.local.get(LATEST_STORAGE_VERSION_ID_KEY))[LATEST_STORAGE_VERSION_ID_KEY];
  }

  public async setLatestStrageVersionId(versionId: string): Promise<void> {
    await chrome.storage.local.set({ LATEST_STORAGE_VERSION_ID_KEY: versionId });
  }

  public async clear(): Promise<void> {
    await chrome.storage.local.clear();
    this.sessionIdCache.clear();
    this.sessionIdCallbacks.clear();
  }

  // Anonymous session ID
  public async getAnonymousSessionId(): Promise<string | undefined> {
    if (this.sessionIdCache.has(ANONYMOUS_SESSION_ID_KEY)) {
      return this.sessionIdCache.get(ANONYMOUS_SESSION_ID_KEY);
    }
    const sessionId = await this.get(ANONYMOUS_SESSION_ID_KEY);
    this.sessionIdCache.set(ANONYMOUS_SESSION_ID_KEY, sessionId);
    return sessionId;
  }

  public async setAnonymousSessionId(sessionId?: string): Promise<void> {
    await this.set<string>(ANONYMOUS_SESSION_ID_KEY, sessionId);
    this.sessionIdCache.set(ANONYMOUS_SESSION_ID_KEY, sessionId);
  }

  public subsribeToAnonymousSessionIdChanges(subscriptionId: string, callback: DataCallback<string>): void {
    this.subscribe<string>(ANONYMOUS_SESSION_ID_KEY, subscriptionId, callback);
  }

  // Authenticated session ID
  public async getAuthenticatedSessionId(): Promise<string | undefined> {
    if (this.sessionIdCache.has(AUTHENTICATED_SESSION_ID_KEY)) {
      return this.sessionIdCache.get(AUTHENTICATED_SESSION_ID_KEY);
    }
    const sessionId = await this.get(AUTHENTICATED_SESSION_ID_KEY);
    this.sessionIdCache.set(AUTHENTICATED_SESSION_ID_KEY, sessionId);
    return sessionId;
  }

  public async setAuthenticatedSessionId(sessionId?: string): Promise<void> {
    await this.set<string>(AUTHENTICATED_SESSION_ID_KEY, sessionId);
    this.sessionIdCache.set(AUTHENTICATED_SESSION_ID_KEY, sessionId);
  }

  public subsribeToAuthenticatedSessionIdChanges(subscriptionId: string, callback: DataCallback<string>): void {
    this.subscribe<string>(AUTHENTICATED_SESSION_ID_KEY, subscriptionId, callback);
  }

  // FindAGrave Memorial data
  public async getFindAGraveMemorialData(memorialId: string): Promise<FindAGraveMemorialData | undefined> {
    const storageRecord = await chrome.storage.local.get(`${FIND_A_GRAVE_MEMORIAL_PREFIX}${memorialId}`);
    const value = storageRecord[`${FIND_A_GRAVE_MEMORIAL_PREFIX}${memorialId}`];
    return value ? JSON.parse(value) : undefined;
  }

  public async setFindAGraveMemorialData(memorialId: string, data: FindAGraveMemorialData | undefined): Promise<void> {
    if (data === null || data === undefined) {
      await chrome.storage.local.remove(`${FIND_A_GRAVE_MEMORIAL_PREFIX}${memorialId}`);
    } else {
      await chrome.storage.local.set({ [`${FIND_A_GRAVE_MEMORIAL_PREFIX}${memorialId}`]: JSON.stringify(data) });
    }
  }

  // #region Private helpers

  private async get(key: string): Promise<string | undefined> {
    return (await chrome.storage.local.get(key))[key];
  }

  private async set<T>(key: string, value: string | undefined): Promise<void> {
    if (value === null || value === undefined) {
      await chrome.storage.local.remove(key);
    } else {
      await chrome.storage.local.set({ [key]: value });
    }
  }

  private subscribe<T>(key: string, subscriptionId: string, callback: DataCallback<T>): void {
    if (!this.sessionIdCallbacks.has(key)) {
      this.sessionIdCallbacks.set(key, new Map());
    }
    this.sessionIdCallbacks.get(key)!.set(subscriptionId, callback);
  }

  // #endregion
}