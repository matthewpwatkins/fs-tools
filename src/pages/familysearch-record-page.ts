import { Page } from "../page";

export class FamilySearchRecordPage implements Page {
  async isMatch(url: URL): Promise<boolean> {
    return url.hostname.toLowerCase().endsWith('familysearch.org')
      && url.pathname.startsWith('/ark:/61903/1:1')
  }

  async onPageEnter(): Promise<void> {
    console.log('FamilySearchRecordPage - onPageEnter');
  }

  async onPageExit(): Promise<void> {
    console.log('FamilySearchRecordPage - onPageExit');
  }

  async onPageContentUpdate(): Promise<void> {
    let searchButton = document.getElementById('btn-search-film');
    if (searchButton) { 
      return;
    }

    const modal = document.querySelector('div[aria-label="Viewing the Image on Film"]');
    if (!modal) {
      return;
    }

    const modalText = modal.querySelector('p');
    if (!modalText) {
      return;
    }

    const browseButton = [...modal.querySelectorAll('button')]
      .find(button => button.textContent?.toLocaleLowerCase().indexOf('cancel') === 0);
    if (!browseButton) {
      return;
    }

    const filmNumber = document.querySelector('a[href^="/search/record/results?q.filmNumber"]')?.textContent;
    if (!filmNumber) {
      return;
    }

    const searchName = document.querySelector('h1')?.textContent;
    if (!searchName) {
      return;
    }

    searchButton = browseButton.cloneNode(true) as HTMLElement;
    searchButton.id = 'btn-search-film';
    searchButton.textContent = '🔎 Search the Film';
    searchButton.onclick = () => {
      // document.location.href = `/search/full-text/results?q.groupName=${filmNumber}&q.text=${encodeURIComponent(searchName)}`;
      window.open(`/search/full-text/results?q.groupName=${filmNumber}&q.text=${encodeURIComponent(searchName)}`, '_blank');
    };
    
    // Add the search button to the end of the text
    modalText.appendChild(searchButton);
  }
}