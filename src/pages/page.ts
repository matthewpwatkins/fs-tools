export interface Page {
  isMatch(url: URL): Promise<boolean>;
  requiresAuthenticatedSession(): boolean;
  onPageEnter(): Promise<void>;
  onPageExit(): Promise<void>;
  onPageContentUpdate(updateID: string): Promise<void>;
}