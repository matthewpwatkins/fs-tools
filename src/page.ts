export interface Page {
  isMatch(url: URL): boolean;
  onPageLoad(): void;
  onPageChange(): void;
}