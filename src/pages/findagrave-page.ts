import { FS_FAVICON_URL } from "../constants";
import { Page } from "../page";

/**
 * Runs on all Find A Grave pages.
 * Adds a FamilySearch link to the page.
 */
export class FindAGravePage implements Page {
  private static readonly FINDAGRAVE_COLLECTION_ID = '2221801';

  isMatch(url: URL): boolean {
    return url.hostname.toLowerCase().endsWith('findagrave.com');
  }

  onPageEnter(): void {
    console.log('FindAGravePage - onPageEnter');
  }

  onPageExit(): void {
    console.log('FindAGravePage - onPageExit');
  }

  onPageContentUpdate(): void {
    for (const grave of document.querySelectorAll('.memorial-item---grave')) {
      const nameElement = grave.querySelector('.pe-2');
      if (!nameElement) {
        continue;
      }

      if (grave.querySelector('.fs-search-link')) {
        continue;
      }

      const memorialLink = grave.closest('a');
      if (!memorialLink) {
        console.warn('Could not find memorial link for grave', grave);
        continue;
      }

      const pathParts = memorialLink.href.split('/');
      const memorialId = pathParts[pathParts.length - 2];
      if (!memorialId) {
        console.warn('Could not find memorial ID for grave', grave);
        continue;
      }

      console.log(`Adding FS link for memorial ${memorialId}`);
      const fsLink = this.createFsLink(memorialId);
      nameElement.parentElement!.insertBefore(fsLink, nameElement.nextSibling);
    }
  }

  private createFsLink(memorialId: string): HTMLAnchorElement {
    const fsIconImage = document.createElement('img');
    fsIconImage.src = FS_FAVICON_URL;
    fsIconImage.alt = 'View on FamilySearch';
    
    const fsLink = document.createElement('a');
    fsLink.classList.add('fs-search-link');
    fsLink.classList.add('add-link');
    fsLink.classList.add('text-wrap');
    fsLink.href = `https://www.familysearch.org/search/record/results?f.collectionId=${FindAGravePage.FINDAGRAVE_COLLECTION_ID}&q.externalRecordId=${memorialId}&click-first-result=true`;
    fsLink.target = '_blank';
    fsLink.title = 'View on FamilySearch';

    fsLink.appendChild(fsIconImage);

    return fsLink;
  }
}
