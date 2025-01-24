export interface Page {
  isMatch(url: URL): boolean;
  onPageEnter(): void;
  onPageExit(): void;
  onPageContentUpdate(): void;
}