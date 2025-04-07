import { DataStorage } from "./data-storage";

type DataCallback<T> = (value?: T) => Promise<void>;

export class ChromeExtensionDataStorage implements DataStorage {
  private dataCache: Map<string, any> = new Map();
  private dataLoadedStates: Map<string, boolean> = new Map();
  private changeCallbacks: Map<string, Map<string, DataCallback<any>>> = new Map();

  constructor() {
    chrome.storage.local.onChanged.addListener((changes) => {
      for (const [key, { newValue }] of Object.entries(changes)) {
        const currentValue = this.dataCache.get(key);
        if (currentValue !== newValue) {
          this.dataCache.set(key, newValue);
          this.changeCallbacks.get(key)?.forEach(callback => {
            callback(newValue);
          });
        }
        this.dataLoadedStates.set(key, true);
      }
    });
  }

  // Type-specific methods
  public getAnonymousSessionId(): Promise<string | undefined> {
    return this.get<string>('anonymous-fs-session-id');
  }

  public setAnonymousSessionId(sessionId?: string): Promise<void> {
    return this.set<string>('anonymous-fs-session-id', sessionId);
  }

  public subsribeToAnonymousSessionIdChanges(subscriptionId: string, callback: DataCallback<string>): void {
    this.subscribe<string>('anonymous-fs-session-id', subscriptionId, callback);
  }

  public getAuthenticatedSessionId(): Promise<string | undefined> {
    return this.get<string>('authenticated-fs-session-id');
  }

  public setAuthenticatedSessionId(sessionId?: string): Promise<void> {
    return this.set<string>('authenticated-fs-session-id', sessionId);
  }

  public subsribeToAuthenticatedSessionIdChanges(subscriptionId: string, callback: DataCallback<string>): void {
    this.subscribe<string>('authenticated-fs-session-id', subscriptionId, callback);
  }

  public async getMemorialRecordId(memorialId: string): Promise<string | undefined> {
    return this.get<string>(`fs.${memorialId}.rid`);
  }

  public async setMemorialRecordId(memorialId: string, recordId: string | undefined): Promise<void> {
    await this.set<string>(`fs.${memorialId}.rid`, recordId);
  }

  public async getMemorialPersonId(memorialId: string): Promise<string | undefined> {
    return this.get<string>(`fs.${memorialId}.pid`);
  }

  public async setMemorialPersonId(memorialId: string, personId: string | undefined): Promise<void> {
    await this.set<string>(`fs.${memorialId}.pid`, personId);
  }

  // Common helper methods
  private async get<T>(key: string): Promise<T | undefined> {
    if (this.dataLoadedStates.get(key)) {
      return this.dataCache.get(key);
    }

    const storageRecord = await chrome.storage.local.get(key);
    const value = storageRecord[key];
    this.dataCache.set(key, value);
    this.dataLoadedStates.set(key, true);
    return value;
  }

  private async set<T>(key: string, value: T | undefined): Promise<void> {
    if (value === null) {
      await chrome.storage.local.remove(key);
    } else {
      await chrome.storage.local.set({ [key]: value });
    }

    this.dataCache.set(key, value);
    this.dataLoadedStates.set(key, true);
    for (const callback of this.changeCallbacks.get(key)?.values() || []) {
      await callback(value);
    }
  }

  private subscribe<T>(key: string, subscriptionId: string, callback: DataCallback<T>): void {
    if (!this.changeCallbacks.has(key)) {
      this.changeCallbacks.set(key, new Map());
    }
    this.changeCallbacks.get(key)!.set(subscriptionId, callback);
  }
}