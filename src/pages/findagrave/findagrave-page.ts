import { FINDAGRAVE_COLLECTION_ID } from "../../constants";
import { FS_FAVICON_URL, PERSON_ICON_HTML, RECORD_ICON_HTML, REFRESH_ICON_HTML, styleIcon } from "../../ui/icons";
import { Page } from "../page";
import { FindAGraveMemorialData, IdStatus } from "../../data/models/findagrave-memorial-data";
import { Logger } from "../../util/logger";
import { FindAGraveMemorialUpdater } from "./findagrave-memorial-updater";

/**
 * Memorial UI tracking elements
 */
interface MemorialUI {
  memorialId: string;
  elements: Set<HTMLElement>; // UI elements associated with this memorial
}

/**
 * Runs on all Find A Grave pages.
 * Adds a FamilySearch link to any memorial search results on the page
 */
export class FindAGravePage implements Page {
  // CSS class names
  private static readonly CSS = {
    BTN_GROUP: 'fs-btn-group',
    MAIN_LINK: 'fs-main-link',
    RECORD_LINK: 'fs-record-link',
    PERSON_LINK: 'fs-person-link',
    REFRESH_LINK: 'fs-data-refresh-link',
    SPIN_CONTAINER: 'fs-spin-container',
    SPIN: 'spin',
    STATUS: {
      DEFAULT: 'fs-status-default',
      GRAY: 'fs-status-gray',
      ORANGE: 'fs-status-orange'
    }
  };

  // Constants
  private static readonly MEMORIAL_ID_REGEX = /^\d+$/;
  private static readonly NON_MEMORIAL_PATHS = new Set([
    'search', 'edit', 'edit#gps-location', 'sponsor', 'memorial'
  ]);
  
  // Memory and state management
  private memorialUIs = new Map<string, MemorialUI>(); // Map of memorialId -> MemorialUI
  private memorialDataCache = new Map<string, FindAGraveMemorialData>(); // Cache of memorial data
  private scanIsDirty = false;
  private scanInProgress = false;
  private observer?: MutationObserver;
  private readonly memorialUpdater: FindAGraveMemorialUpdater;

  constructor(memorialUpdater: FindAGraveMemorialUpdater) {
    this.memorialUpdater = memorialUpdater;
    this.memorialUpdater.onMemorialUpdateStart = this.handleMemorialUpdateStart.bind(this),
    this.memorialUpdater.onMemorialUpdateEnd = this.handleMemorialUpdateEnd.bind(this),
    this.memorialUpdater.onMemorialDataUpdate = this.handleMemorialDataUpdate.bind(this);
    this.setupStyles();
  }

  public async isMatch(url: URL): Promise<boolean> {
    return url.hostname.toLowerCase().endsWith('findagrave.com');
  }

  public requiresAuthenticatedSession(): boolean {
    return true;
  }

  public async onPageEnter(): Promise<void> {
    this.setupMutationObserver();
    this.scanForMemorials();
  }

  public async onPageExit(): Promise<void> {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
  }

  public async onPageContentUpdate(): Promise<void> {
    this.scanForMemorials();
  }

  //
  // DOM Observation & Scanning
  //

  private setupMutationObserver(): void {
    this.observer = new MutationObserver(async (mutations) => {
      let shouldScan = false;
      
      for (const mutation of mutations) {
        // Ignore mutations caused by our own updates
        if (mutation.target instanceof Element && 
            (mutation.target.classList?.contains(FindAGravePage.CSS.BTN_GROUP) ||
             mutation.target.closest(`.${FindAGravePage.CSS.BTN_GROUP}`))) {
          continue;
        }
        shouldScan = true;
        break;
      }
      
      if (shouldScan) {
        await this.scanForMemorials();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private async scanForMemorials(): Promise<void> {
    if (this.scanInProgress) {
      this.scanIsDirty = true;
      return;
    }

    do {
      this.scanInProgress = true;
      this.scanIsDirty = false;

      // Scan header element (memorial details page)
      Logger.debug('Scanning for memorials in headers...');
      const memorialNameHeader = document.getElementById('bio-name') as HTMLHeadingElement;
      if (memorialNameHeader) {
        const memorialId = this.extractMemorialIdFromLocation();
        if (memorialId) {
          await this.addOrUpdateMemorialElement(memorialNameHeader, memorialId);
        }
      }

      // Scan all memorial links
      Logger.debug('Scanning for memorials in links...');
      for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href^="/memorial/"]')) {
        const memorialId = this.extractMemorialIdFromUrl(link.href);
        if (memorialId) {
          await this.addOrUpdateMemorialElement(link, memorialId);
        }
      }
    } while (this.scanIsDirty);

    this.scanInProgress = false;
  }

  private extractMemorialIdFromUrl(url: string): string | undefined {
    const urlObj = new URL(url, window.location.origin);
    return this.extractMemorialIdFromPath(urlObj.pathname);
  }

  private extractMemorialIdFromLocation(): string | undefined {
    return this.extractMemorialIdFromPath(document.location.pathname);
  }

  private extractMemorialIdFromPath(path: string): string | undefined {
    const pathComponents = path.split('/').filter(c => c.length > 0);
    
    // Path should be /memorial/{id}/{name}
    if (pathComponents.length !== 3 || pathComponents[0] !== 'memorial') {
      return undefined;
    }

    const memorialId = pathComponents[1];
    const memorialName = pathComponents[2];
    
    // Validate memorial ID format (numbers only)
    if (!memorialId.match(FindAGravePage.MEMORIAL_ID_REGEX)) {
      return undefined;
    }

    // Skip non-memorial paths
    if (FindAGravePage.NON_MEMORIAL_PATHS.has(memorialName)) {
      return undefined;
    }

    return memorialId;
  }

  //
  // Memorial Management
  //

  private async addOrUpdateMemorialElement(element: HTMLElement, memorialId: string): Promise<void> {
    let memorialUI = this.memorialUIs.get(memorialId);

    if (memorialUI) {
      if (memorialUI.elements.has(element)) {
        return;
      }
      memorialUI.elements.add(element);
    } else {
      // Create UI wrapper with elements set
      memorialUI = {
        memorialId,
        elements: new Set([element]),
      };
      this.memorialUIs.set(memorialId, memorialUI);
      
      // Add memorial to the updater to get data
      await this.memorialUpdater.addMemorialId(memorialId);
    }
    
    // Render using cached data if available
    const cachedData = this.memorialDataCache.get(memorialId);
    if (cachedData) {
      this.renderMemorialLinks(memorialId, element, cachedData);
    } else {
      this.renderMemorialLinks(memorialId, element);
    }
  }

  // Handle callbacks from the updater
  private handleMemorialUpdateStart(memorialId: string): void {
    this.setMemorialProcessingState(memorialId, true);
  }

  private handleMemorialUpdateEnd(memorialId: string): void {
    this.setMemorialProcessingState(memorialId, false);
  }

  private handleMemorialDataUpdate(memorialId: string, data: FindAGraveMemorialData): void {
    this.memorialDataCache.set(memorialId, data);
    const memorialUI = this.memorialUIs.get(memorialId);
    if (memorialUI) {
      memorialUI.elements.forEach(element => {
        this.renderMemorialLinks(memorialId, element, data);
      });
    }
  }

  private setMemorialProcessingState(memorialId: string, isProcessing: boolean): void {
    const memorialUI = this.memorialUIs.get(memorialId);
    if (memorialUI) {
      memorialUI.elements.forEach(element => {
        const refreshSpinner = element.querySelector<HTMLElement>(`.${FindAGravePage.CSS.REFRESH_LINK}`)?.querySelector(`.${FindAGravePage.CSS.SPIN_CONTAINER}`);
        if (refreshSpinner) {
          if (isProcessing) {
            refreshSpinner.classList.add(FindAGravePage.CSS.SPIN);
          } else {
            refreshSpinner.classList.remove(FindAGravePage.CSS.SPIN);
          }
        }
      });
    }
  }

  //
  // UI Rendering
  //

  private renderMemorialLinks(memorialId: string, element: HTMLElement, data?: FindAGraveMemorialData): void {
    // Create or get the button group
    let btnGroup = element.querySelector<HTMLDivElement>(`.${FindAGravePage.CSS.BTN_GROUP}`);
    if (!btnGroup) {
      btnGroup = document.createElement('div');
      btnGroup.className = FindAGravePage.CSS.BTN_GROUP;
      btnGroup.style.display = 'inline-block';
      btnGroup.style.marginLeft = '8px';
      
      // Insert after text element if available, otherwise append to the element
      const textElement = element.querySelector('h1, h2, h3, h4, h5, h6, p');
      if (textElement) {
        textElement.insertAdjacentElement('afterend', btnGroup);
      } else {
        element.appendChild(btnGroup);
      }
    }

    // Create or update the main link
    let mainLink = btnGroup.querySelector<HTMLAnchorElement>(`.${FindAGravePage.CSS.MAIN_LINK}`);
    if (!mainLink) {
      mainLink = document.createElement('a');
      mainLink.className = FindAGravePage.CSS.MAIN_LINK;
      mainLink.target = '_blank';
      mainLink.onclick = (e) => e.stopPropagation();
      
      const fsIcon = document.createElement('img');
      fsIcon.src = FS_FAVICON_URL;
      styleIcon(fsIcon);
      mainLink.appendChild(fsIcon);
      
      btnGroup.appendChild(mainLink);
    }

    // Create or update record link
    let recordLink = btnGroup.querySelector<HTMLAnchorElement>(`.${FindAGravePage.CSS.RECORD_LINK}`);
    if (!recordLink) {
      recordLink = document.createElement('a');
      recordLink.classList.add(FindAGravePage.CSS.RECORD_LINK, FindAGravePage.CSS.STATUS.GRAY);
      recordLink.target = '_blank';
      recordLink.onclick = (e) => e.stopPropagation();
      recordLink.innerHTML = RECORD_ICON_HTML;
      btnGroup.appendChild(recordLink);
    }

    // Create or update person link
    let personLink = btnGroup.querySelector<HTMLAnchorElement>(`.${FindAGravePage.CSS.PERSON_LINK}`);
    if (!personLink) {
      personLink = document.createElement('a');
      personLink.classList.add(FindAGravePage.CSS.PERSON_LINK, FindAGravePage.CSS.STATUS.GRAY);
      personLink.target = '_blank';
      personLink.onclick = (e) => {
        e.stopPropagation();
        const memorialData = this.memorialDataCache.get(memorialId);
        if (!memorialData || memorialData.personIdStatus !== IdStatus.FOUND) {
          e.preventDefault();
        }
      };
      personLink.innerHTML = PERSON_ICON_HTML;
      btnGroup.appendChild(personLink);
    }

    // Create or update refresh link
    let refreshLink = btnGroup.querySelector<HTMLAnchorElement>(`.${FindAGravePage.CSS.REFRESH_LINK}`);
    if (!refreshLink) {
      refreshLink = document.createElement('a');
      refreshLink.classList.add(FindAGravePage.CSS.REFRESH_LINK, FindAGravePage.CSS.STATUS.GRAY);
      refreshLink.href = '#';
      refreshLink.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await this.memorialUpdater.triggerMemorialUpdate(memorialId);
      };
      
      // Wrap the SVG in a span for better animation control
      const spinContainer = document.createElement('span');
      spinContainer.className = FindAGravePage.CSS.SPIN_CONTAINER;
      spinContainer.innerHTML = REFRESH_ICON_HTML;
      refreshLink.appendChild(spinContainer);
      
      btnGroup.appendChild(refreshLink);
    }

    // Update links based on current state
    if (data) {
      this.updateLinkStates(memorialId, { mainLink, recordLink, personLink, refreshLink }, data);
    }
  }

  private updateLinkStates(
    memorialId: string,
    links: { 
      mainLink: HTMLAnchorElement, 
      recordLink: HTMLAnchorElement, 
      personLink: HTMLAnchorElement,
      refreshLink: HTMLAnchorElement
    },
    data: FindAGraveMemorialData
  ): void {
    const { mainLink, recordLink, personLink, refreshLink } = links;

    // Record link state
    recordLink.classList.remove(
      FindAGravePage.CSS.STATUS.DEFAULT,
      FindAGravePage.CSS.STATUS.GRAY,
      FindAGravePage.CSS.STATUS.ORANGE
    );

    // Update the link URLs using the memorial updater
    const recordSearchUrl = this.memorialUpdater.getRecordSearchUrl(memorialId);
    
    switch (data.recordIdStatus) {
      case IdStatus.UNKNOWN:
        recordLink.classList.add(FindAGravePage.CSS.STATUS.GRAY);
        recordLink.href = recordSearchUrl;
        recordLink.title = 'Searching FamilySearch for this record, please wait...';
        break;
      case IdStatus.FOUND:
        recordLink.classList.add(FindAGravePage.CSS.STATUS.DEFAULT);
        recordLink.href = `https://www.familysearch.org/ark:/61903/1:1:${data.recordId}`;
        recordLink.title = 'View record in FamilySearch';
        break;
      case IdStatus.NONE:
        recordLink.classList.add(FindAGravePage.CSS.STATUS.ORANGE);
        recordLink.href = recordSearchUrl;
        recordLink.title = 'No record found in FamilySearch';
        recordLink.style.cursor = 'default';
        break;
    }

    // Person link state
    personLink.classList.remove(
      FindAGravePage.CSS.STATUS.DEFAULT,
      FindAGravePage.CSS.STATUS.GRAY,
      FindAGravePage.CSS.STATUS.ORANGE
    );

    switch (data.personIdStatus) {
      case IdStatus.UNKNOWN:
        personLink.classList.add(FindAGravePage.CSS.STATUS.GRAY);
        personLink.href = '#';
        personLink.style.display = '';
        personLink.title = data.recordIdStatus === IdStatus.UNKNOWN ? 'Searching, please wait...' : (data.recordIdStatus === IdStatus.NONE ? 'No record found in FamilySearch' : 'You are not logged into FamilySearch');
        personLink.style.cursor = 'default';
        break;
      case IdStatus.FOUND:
        personLink.classList.add(FindAGravePage.CSS.STATUS.DEFAULT);
        personLink.href = `https://www.familysearch.org/tree/person/details/${data.personId}`;
        personLink.style.display = '';
        personLink.title = 'View person in FamilySearch';
        personLink.style.cursor = 'pointer';
        break;
      case IdStatus.NONE:
        personLink.classList.add(FindAGravePage.CSS.STATUS.ORANGE);
        personLink.href = '#';
        personLink.style.display = '';
        personLink.title = 'No person attached to this record in FamilySearch';
        personLink.style.cursor = 'default';
        break;
    }

    // Refresh link state
    refreshLink.classList.remove(
      FindAGravePage.CSS.STATUS.DEFAULT,
      FindAGravePage.CSS.STATUS.GRAY,
      FindAGravePage.CSS.STATUS.ORANGE
    );

    const isDefault = data.recordIdStatus !== IdStatus.UNKNOWN || data.personIdStatus !== IdStatus.UNKNOWN;
    refreshLink.classList.add(isDefault ? FindAGravePage.CSS.STATUS.DEFAULT : FindAGravePage.CSS.STATUS.GRAY);

    // Main link state - points to person if available, otherwise record
    if (data.personIdStatus === IdStatus.FOUND) {
      mainLink.href = personLink.href;
    } else {
      mainLink.href = recordLink.href;
    }
  }

  private setupStyles(): void {
    const style = document.createElement('style');
    style.innerHTML = `
      .${FindAGravePage.CSS.BTN_GROUP} {
        display: inline-block;
        margin-left: 8px;
      }
      .${FindAGravePage.CSS.BTN_GROUP} a {
        margin-right: 5px;
        text-decoration: none;
      }
      .${FindAGravePage.CSS.SPIN_CONTAINER} {
        display: inline-block;
      }
      .${FindAGravePage.CSS.SPIN} {
        animation: fs-spin 1s linear infinite;
        transform-origin: center;
        display: inline-block;
      }
      @keyframes fs-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .${FindAGravePage.CSS.STATUS.DEFAULT} { color: inherit; }
      .${FindAGravePage.CSS.STATUS.GRAY} { color: #888888 !important; }
      .${FindAGravePage.CSS.STATUS.ORANGE} { color: #FFA500 !important; }
      
      /* Maintain status colors on hover */
      .${FindAGravePage.CSS.BTN_GROUP} a.${FindAGravePage.CSS.STATUS.DEFAULT}:hover { color: inherit; }
      .${FindAGravePage.CSS.BTN_GROUP} a.${FindAGravePage.CSS.STATUS.GRAY}:hover { color: #888888 !important; }
      .${FindAGravePage.CSS.BTN_GROUP} a.${FindAGravePage.CSS.STATUS.ORANGE}:hover { color: #FFA500 !important; }
    `;
    document.head.appendChild(style);
  }
}
