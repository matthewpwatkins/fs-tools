import { DataStorage } from "../../fs-api/data-storage";
import { Page } from "../../page";
import { getFamilySearchSessionIdFromCookie } from "../../util/cookie-utils";

/**
 * Runs on all familysearch.org pages.
 * Adds a menu command to copy the session ID.
 */
export class FamilySearchPage implements Page {
  private readonly dataStorage: DataStorage;
  private authenticatedSessionId?: string;

  constructor(sessionIdStorage: DataStorage) {
    this.dataStorage = sessionIdStorage;
  }
  
  async isMatch(url: URL): Promise<boolean> {
    return url.hostname.toLowerCase().endsWith('familysearch.org');
  }

  requiresAuthenticatedSessionId(): boolean {
    return false;
  }
  
  public async handleVersionUpgrade(oldVersion: string | undefined, newVersion: string): Promise<void> {
    // Do nothing
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
      await this.dataStorage.setAuthenticatedSessionId(this.authenticatedSessionId);
    }
  }
}