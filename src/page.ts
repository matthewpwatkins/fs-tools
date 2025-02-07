export interface Page {
  isMatch(url: URL): Promise<boolean>;
  onPageEnter(): Promise<void>;
  onPageExit(): Promise<void>;
  onPageContentUpdate(updateID: string): Promise<void>;
}