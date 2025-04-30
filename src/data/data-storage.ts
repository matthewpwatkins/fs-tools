import { FindAGraveMemorialData } from "./models/findagrave-memorial-data";

export interface IpAddressData {
  ipAddress: string;
  createdAt: number; // timestamp when this IP address data was created
}

export interface Version {
  version: string;
  build: string;
}

export interface Session {
  sessionId: string;
  createdAt: number; // timestamp when this session data was created
}

export interface DataStorage {
  getLastRunVersion(): Promise<Version | undefined>;
  setLastRunVersion(version: Version): Promise<void>;
  clear(): Promise<void>;

  // Anonymous session ID
  getAnonymousSession(): Promise<Session | undefined>;
  setAnonymousSession(session?: Session): Promise<void>;
  subsribeToAnonymousSessionChanges(subscriptionId: string, callback: (session?: Session) => Promise<void>): void;

  // Authenticated session ID
  getAuthenticatedSession(): Promise<Session | undefined>;
  setAuthenticatedSession(session?: Session): Promise<void>;
  subsribeToAuthenticatedSessionChanges(subscriptionId: string, callback: (session?: Session) => Promise<void>): void;

  // Memorial data (record and person IDs)
  getFindAGraveMemorialData(memorialId: string): Promise<FindAGraveMemorialData | undefined>;
  setFindAGraveMemorialData(memorialId: string, data: FindAGraveMemorialData | undefined): Promise<void>;
  
  // IP Address
  getIpAddressData(): Promise<IpAddressData | undefined>;
  setIpAddressData(data: IpAddressData): Promise<void>;
}