export interface Page {
  isMatch(url: URL): boolean;
  onPageEnter(): void;
  onPageContentUpdate(): void;
  onPageExit(): void;
}