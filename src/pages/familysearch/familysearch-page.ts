import { FsSessionIdStorage } from "../../fs-api/fs-session-id-storage";
import { Page } from "../../page";
import { getFamilySearchSessionIdFromCookie } from "../../util/cookie-utils";

/**
 * Runs on all familysearch.org pages.
 * Adds a menu command to copy the session ID.
 */
export class FamilySearchPage implements Page {
  private readonly sessionIdStorage: FsSessionIdStorage;
  private authenticatedSessionId?: string;

  constructor(sessionIdStorage: FsSessionIdStorage) {
    this.sessionIdStorage = sessionIdStorage;
  }
  
  async isMatch(url: URL): Promise<boolean> {
    return url.hostname.toLowerCase().endsWith('familysearch.org');
  }

  requiresAuthenticatedSessionId(): boolean {
    return false;
  }

  async onPageEnter(): Promise<void> {
    console.log('FamilySearchPage - onPageEnter');
    await this.updateSessionId();
  }

  async onPageExit(): Promise<void> {
    console.log('FamilySearchPage - onPageExit');
  }

  async onPageContentUpdate(updateID: string): Promise<void> {
    this.updateSessionId();
  }

  private async updateSessionId(): Promise<void> {
    const currentSessionId = getFamilySearchSessionIdFromCookie();
    if (currentSessionId !== this.authenticatedSessionId) {
      this.authenticatedSessionId = currentSessionId;
      await this.sessionIdStorage.setAuthenticatedSessionId(this.authenticatedSessionId);
    }
  }
}