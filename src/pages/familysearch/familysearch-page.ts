import { DataStorage } from "../../fs-api/data-storage";
import { Page } from "../../page";
import { getFamilySearchSessionIdFromCookie } from "../../util/cookie-utils";

/**
 * Runs on all familysearch.org pages.
 * Adds a menu command to copy the session ID.
 */
export class FamilySearchPage implements Page {
  private static readonly FULL_TEXT_SEARCH_MENU_ITEM_ID = 'full-text-search-menu-item';

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
    await this.updateSessionId();
  }

  async onPageExit(): Promise<void> {
    
  }

  async onPageContentUpdate(updateID: string): Promise<void> {
    this.injectFullTextSearchMenuItem();
    await this.updateSessionId();
  }

  private async updateSessionId(): Promise<void> {
    const currentSessionId = getFamilySearchSessionIdFromCookie();
    if (currentSessionId !== this.authenticatedSessionId) {
      this.authenticatedSessionId = currentSessionId;
      await this.dataStorage.setAuthenticatedSessionId(this.authenticatedSessionId);
    }
  }

  private injectFullTextSearchMenuItem(): void {
    let fullTextSearchLi = document.getElementById(FamilySearchPage.FULL_TEXT_SEARCH_MENU_ITEM_ID);
    if (fullTextSearchLi) {
      console.log('Full-Text Search menu item already exists, skipping injection.');
      return;
    }
  
    const headerNav = document.querySelector('header nav');
    if (!headerNav) {
      console.log('Header nav not found, skipping injection.');
      return;
    }
  
    const recordsLi = Array.from(headerNav.querySelectorAll('li')).find(li => {
      return li.querySelector('a')?.innerText?.trim() === 'Records';
    });
    
    if (!recordsLi) {
      console.log('Records menu item not found, skipping injection.');
      return;
    }
  
    // Clone that li element with the text of full-text search
    fullTextSearchLi = recordsLi.cloneNode(true) as HTMLLIElement;
    fullTextSearchLi.id = FamilySearchPage.FULL_TEXT_SEARCH_MENU_ITEM_ID;
    
    // Update the link text and URL
    const fullTextSearchLink = fullTextSearchLi.querySelector('a')!;
    fullTextSearchLink.setAttribute('href', '/en/search/full-text');

    const textSpan = [...fullTextSearchLink.querySelectorAll('span')].find(span => span.firstChild?.nodeType === Node.TEXT_NODE && span.innerText.trim() === 'Records')!;
    textSpan.innerText = 'Full-Text';
    
    // Place the new li right after the original li
    recordsLi.insertAdjacentElement('afterend', fullTextSearchLi);
  }
}
