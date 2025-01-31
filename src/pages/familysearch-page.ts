import { Page } from "../page";
import { getFamilySearchSessionId } from "../util/cookie-utils";

/**
 * Runs on all familysearch.org pages.
 * Adds a menu command to copy the session ID.
 */
export class FamilySearchPage implements Page {
  private sessionId?: string;
  
  async isMatch(url: URL): Promise<boolean> {
    return url.hostname.toLowerCase().endsWith('familysearch.org');
  }

  async onPageEnter(): Promise<void> {
    console.log('FamilySearchPage - onPageEnter');
    GM_registerMenuCommand('Copy Session ID', async () => {
      const sessionID = getFamilySearchSessionId();
      if (!sessionID) {
        alert('Session ID not found');
        return;
      }
      await GM.setClipboard(sessionID);
      alert('Session ID copied to clipboard');
    }, { accessKey: 'c', autoClose: true });
  }

  async onPageExit(): Promise<void> {
    console.log('FamilySearchPage - onPageExit');
  }

  async onPageContentUpdate(): Promise<void> {
    if (!this.sessionId) {
      this.sessionId = getFamilySearchSessionId();
      await GM.setValue('fs-session-id', this.sessionId);
    }
  }
}