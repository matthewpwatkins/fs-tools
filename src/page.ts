export interface Page {
  isMatch(url: URL): Promise<boolean>;
  requiresAuthenticatedSessionId(): boolean;
  onPageEnter(): Promise<void>;
  onPageExit(): Promise<void>;
  onPageContentUpdate(updateID: string): Promise<void>;
  handleVersionUpgrade(oldVersion: string | undefined, newVersion: string): Promise<void>;
}