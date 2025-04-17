import { AnonymousApiClient } from "../../fs-api/anonymous-api-client";
import { SEARCH_ICON_HTML } from "../../icons";
import { Page } from "../../page";
import { createFullTextSearchForm } from "../../util/familysearch-utils";
import { buildSearchUrlForPerson, SearchDetailLevel } from "../../util/gedcomx-utils";

export class FamilySearchRecordPage implements Page {
  private readonly fsApiClient: AnonymousApiClient;

  private searchLinksGenerated = false;

  constructor(fsApiClient: AnonymousApiClient) {
    this.fsApiClient = fsApiClient;
  }

  async isMatch(url: URL): Promise<boolean> {
    return url.hostname.toLowerCase().endsWith('familysearch.org')
      && url.pathname.indexOf('/ark:/61903/1:1') >= 0;
  }

  requiresAuthenticatedSessionId(): boolean {
    return false;
  }
  
  public async handleVersionUpgrade(oldVersion: string | undefined, newVersion: string): Promise<void> {
    // Do nothing
  }

  async onPageEnter(): Promise<void> {
    
  }

  async onPageExit(): Promise<void> {
    
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

    const modalText = [...modal.querySelectorAll('p')].pop();
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

    const newText = modalText.cloneNode(true) as HTMLElement;
    newText.innerText = 'Or you can search the AI-transcribed text of the film:';
    modalText.parentNode?.insertBefore(newText, modalText.nextSibling);

    const searchForm = createFullTextSearchForm({
      id: 'btn-search-film',
      groupName: filmNumber,
      placeholderText: 'Search this film',
      defaultValue: searchName
    });

    const searchFormContainer = document.createElement('div');
    searchFormContainer.style.marginTop = '10px';
    searchFormContainer.style.display = 'flex';
    searchFormContainer.style.justifyContent = 'center';
    searchFormContainer.appendChild(searchForm);

    modalText.parentNode?.insertBefore(searchFormContainer, newText.nextSibling);
  }

  private async addTreeSearchLink() {    
    if (this.searchLinksGenerated) {
      return;
    }

    const attachToTreeButton = document.querySelector<HTMLAnchorElement>('[data-testid="attachToFamilyTree-Button"]');
    if (!attachToTreeButton) {
      return;
    }

    const recordArk = document.location.pathname.substring(1);
    if (!recordArk) {
      return;
    }

    this.searchLinksGenerated = true;
    const record = await this.fsApiClient.getArk(recordArk);
    const primaryPerson = record.persons?.find(person => person.principal);
    if (!primaryPerson) {
      return;
    }

    const treeSearchButton = attachToTreeButton.cloneNode(true) as HTMLAnchorElement;
    treeSearchButton.innerHTML = `${SEARCH_ICON_HTML} Search Tree`;
    treeSearchButton.href = buildSearchUrlForPerson('tree', record, undefined, SearchDetailLevel.StandardWithSpouse).toString();
    treeSearchButton.style.marginBottom = '10px';

    const treeSearchButtonContainer = document.createElement('div');
    treeSearchButtonContainer.appendChild(treeSearchButton);

    const recordSearchButton = attachToTreeButton.cloneNode(true) as HTMLAnchorElement;
    recordSearchButton.innerHTML = `${SEARCH_ICON_HTML} Search Records`;
    recordSearchButton.href = buildSearchUrlForPerson('record', record, undefined, SearchDetailLevel.StandardWithSpouse).toString();
    recordSearchButton.style.marginBottom = '10px';

    const recordSearchButtonContainer = document.createElement('div');
    recordSearchButtonContainer.appendChild(recordSearchButton);

    attachToTreeButton.parentElement?.insertBefore(treeSearchButtonContainer, attachToTreeButton);
    attachToTreeButton.parentElement?.insertBefore(recordSearchButtonContainer, treeSearchButtonContainer);
  }
}