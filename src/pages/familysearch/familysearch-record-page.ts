import { FsApiClient } from "../../fs-api/fs-api-client";
import { Name, Date } from "../../fs-api/models/gedcomx";
import { Page } from "../../page";
import { buildSearchUrlForPerson } from "../../util/gedcomx-utils";

export class FamilySearchRecordPage implements Page {
  private static readonly FS_TREE_SEARCH_LINK_ID = 'fs-tree-search-link';
  
  private readonly fsApiClient: FsApiClient;

  constructor(fsApiClient: FsApiClient) {
    this.fsApiClient = fsApiClient;
  }

  async isMatch(url: URL): Promise<boolean> {
    return url.hostname.toLowerCase().endsWith('familysearch.org')
      && url.pathname.indexOf('/ark:/61903/1:1') >= 0;
  }

  async onPageEnter(): Promise<void> {
    console.log('FamilySearchRecordPage - onPageEnter');
  }

  async onPageExit(): Promise<void> {
    console.log('FamilySearchRecordPage - onPageExit');
  }

  async onPageContentUpdate(updateID: string): Promise<void> {
    this.addFilmSearchLink();
    await this.addTreeSearchLink();
  }

  private addFilmSearchLink() {
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

    const filmNumber = document.querySelector('a[href*="/search/record/results?q.filmNumber"]')?.textContent;
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

  private async addTreeSearchLink() {    
    let fsTreeSearchLink = document.getElementById(FamilySearchRecordPage.FS_TREE_SEARCH_LINK_ID);
    if (fsTreeSearchLink) {
      return;
    }

    const attachToTreeButton = document.querySelector('[data-testid="attachToFamilyTree-Button"]');
    if (!attachToTreeButton) {
      return;
    }

    const recordArk = document.location.pathname.substring(1);
    if (!recordArk) {
      return;
    }

    console.log('Record ARK', recordArk);
    const record = await this.fsApiClient.getArk(recordArk);
    console.log('Record GEDCOMX', record);

    const primaryPerson = record.persons?.find(person => person.principal);
    if (!primaryPerson) {
      return;
    }

    for (const entityType of ['tree', 'record']) {
      const searchURL = buildSearchUrlForPerson(entityType as 'tree' | 'record', primaryPerson);
      const treeSearchLink = document.createElement('a');
      treeSearchLink.id = FamilySearchRecordPage.FS_TREE_SEARCH_LINK_ID;
      treeSearchLink.setAttribute('href', searchURL.toString());
      treeSearchLink.setAttribute('target', '_blank');
      treeSearchLink.innerText = '🔎 Search ' + (entityType === 'tree' ? 'Family Tree' : 'Records');
      const div = document.createElement('div');
      div.style.marginBottom = '10px';
      div.appendChild(treeSearchLink);
      attachToTreeButton.parentElement?.insertBefore(div, attachToTreeButton);
    }    
  }
}