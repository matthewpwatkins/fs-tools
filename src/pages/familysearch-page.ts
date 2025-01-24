import { Page } from "../page";
import { getFamilySearchSessionId } from "../util/cookie-utils";

/**
 * Runs on all familysearch.org pages.
 * Adds a menu command to copy the session ID.
 */
export class FamilySearchPage implements Page {
  isMatch(url: URL): boolean {
    return url.hostname.toLowerCase().endsWith('.familysearch.org');
  }

  onPageEnter(): void {
    console.log('FamilySearchPage - onPageEnter');
    GM_registerMenuCommand('Copy Session ID', () => {
      const sessionID = getFamilySearchSessionId();
      if (!sessionID) {
        alert('Session ID not found');
        return;
      }
      GM_setClipboard(sessionID);
      alert('Session ID copied to clipboard');
    }, { accessKey: 'c', autoClose: true });
  }

  onPageExit(): void {
    console.log('FamilySearchPage - onPageExit');
  }

  onPageContentUpdate(): void {
    // No-op
  }
}