import { FsSessionIdStorage } from "../../fs-api/fs-session-id-storage";
import { Page } from "../../page";
import { getFamilySearchSessionIdFromCookie } from "../../util/cookie-utils";

/**
 * Runs on all familysearch.org pages.
 * Adds a menu command to copy the session ID.
 */
export class FamilySearchPage implements Page {
  private readonly sessionIdStorage: FsSessionIdStorage;
  private sessionId?: string;

  constructor(sessionIdStorage: FsSessionIdStorage) {
    this.sessionIdStorage = sessionIdStorage;
  }
  
  async isMatch(url: URL): Promise<boolean> {
    return url.hostname.toLowerCase().endsWith('familysearch.org');
  }

  async onPageEnter(): Promise<void> {
    console.log('FamilySearchPage - onPageEnter');
    this.updateSessionId();
    GM_registerMenuCommand('Copy Session ID', async () => {
      this.updateSessionId();
      if (!this.sessionId) {
        alert('Session ID not found');
        return;
      }
      await GM.setClipboard(this.sessionId);
      alert('Session ID copied to clipboard');
    }, { accessKey: 'c', autoClose: true });
  }

  async onPageExit(): Promise<void> {
    console.log('FamilySearchPage - onPageExit');
  }

  async onPageContentUpdate(updateID: string): Promise<void> {
    this.updateSessionId();
  }

  private updateSessionId(): void {
    if (!this.sessionId) {
      this.sessionId = getFamilySearchSessionIdFromCookie();
      if (this.sessionId) {
        this.sessionIdStorage.setSessionId(this.sessionId);
      }
    }
  }
}