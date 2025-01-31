import { FINDAGRAVE_COLLECTION_ID, FS_FAVICON_URL } from "../constants";
import { FsApiClient } from "../fs-api/fs-api-client";

export function createFsLink(memorialId: string): HTMLAnchorElement {
  const fsIconImage = document.createElement('img');
  fsIconImage.src = FS_FAVICON_URL;
  fsIconImage.alt = 'View on FamilySearch';
  
  const fsLink = document.createElement('a');
  fsLink.dataset.memorialId = memorialId;
  fsLink.classList.add('fs-search-link');
  fsLink.classList.add('add-link');
  fsLink.classList.add('text-wrap');
  fsLink.href = `https://www.familysearch.org/search/record/results?f.collectionId=${FINDAGRAVE_COLLECTION_ID}&q.externalRecordId=${memorialId}&click-first-result=true`;
  fsLink.target = '_blank';
  fsLink.title = 'View on FamilySearch';

  fsLink.appendChild(fsIconImage);

  return fsLink;
}

export async function updateFsLink(fsLink: HTMLAnchorElement, fsApiClient: FsApiClient): Promise<void> {
  const memorialId = fsLink.dataset.memorialId!;
  const localStorageKey = `${memorialId}.fsId`;
  let fsId = localStorage.getItem(localStorageKey);
  if (!fsId) {
    const searchRecordsResponse = await fsApiClient.searchRecords(new URLSearchParams({
      'q.externalRecordId': fsLink.dataset.memorialId!,
      'f.collectionId': FINDAGRAVE_COLLECTION_ID
    }));
    fsId = searchRecordsResponse.entries.length === 1 ? searchRecordsResponse.entries[0].id : 'NONE';
    localStorage.setItem(localStorageKey, fsId);
  }
  if (fsId !== 'NONE') {
    fsLink.href = `https://www.familysearch.org/ark:/61903/1:1:${fsId}`;
  }  
}