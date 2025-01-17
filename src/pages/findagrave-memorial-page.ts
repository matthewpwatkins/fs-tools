import { FS_FAVICON_URL } from "../constants";
import { Page } from "../page";

/**
 * Runs on all Find A Grave memorial pages.
 * Adds a FamilySearch link to the page.
 */
export class FindAGraveMemorialPage implements Page {
    private fsLinkAdded: boolean = false;

  isMatch(url: URL): boolean {
    return url.hostname.toLowerCase().endsWith('.findagrave.com') && url.pathname.startsWith('/memorial/');
  }

  onPageLoad(): void {
    // No-op
  }

  onPageChange(): void {
    if (this.fsLinkAdded) {
      return;
    }
    
    const nameHeader = document.getElementById('bio-name') as HTMLHeadingElement;
    if (!nameHeader) {
      return;
    }

    console.log('Adding memorial tools link');
    const fslink = this.createFsLink();
    nameHeader.appendChild(fslink);
    this.fsLinkAdded = true;
  }

  private createFsLink(): HTMLAnchorElement {
    const fsIconImage = document.createElement('img');
    fsIconImage.src = FS_FAVICON_URL;
    fsIconImage.alt = 'View on FamilySearch';
    
    const memorialId = document.location.pathname.split('/')[2];
    const fsLink = document.createElement('a');
    fsLink.setAttribute('id', 'memorial-tools-link');
    fsLink.classList.add('add-link');
    fsLink.classList.add('text-wrap');
    fsLink.href = `https://www.familysearch.org/search/record/results?f.collectionId=2221801&q.externalRecordId=${memorialId}&click-first-result=true`;
    fsLink.target = '_blank';
    fsLink.title = 'View on FamilySearch';

    fsLink.appendChild(fsIconImage);

    return fsLink;
  }
}
