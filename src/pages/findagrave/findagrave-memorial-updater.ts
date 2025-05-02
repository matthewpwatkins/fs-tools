import { DataStorage } from "../../data/data-storage";
import { FindAGraveMemorialData, IdStatus } from "../../data/models/findagrave-memorial-data";
import { AnonymousApiClient } from "../../fs-api/anonymous-api-client";
import { AuthenticatedApiClient } from "../../fs-api/authenticated-api-client";
import { Logger } from "../../util/logger";
import { FINDAGRAVE_COLLECTION_ID } from "../../constants";

// Add a Memorial data model interface that's independent of UI elements
export interface Memorial {
  memorialId: string;
  data: FindAGraveMemorialData;
  isProcessing: boolean;
}

export class FindAGraveMemorialUpdater {
  private static readonly MIN_PROCESSING_TIME_MS = 500;

  // Callbacks
  public onMemorialUpdateStart?: ((memorialId: string) => void);
  public onMemorialDataUpdate?: ((memorialId: string, data: FindAGraveMemorialData) => void);
  public onMemorialUpdateEnd?: ((memorialId: string) => void);
  
  private readonly dataStorage: DataStorage;
  private readonly anonymousFsApiClient: AnonymousApiClient;
  private readonly authenticatedFsApiClient: AuthenticatedApiClient;
  
  // Track memorials independently of DOM elements
  private memorials = new Map<string, Memorial>();
  private memorialUpdateQueue: string[] = [];
  private isProcessingQueue = false;

  constructor(
    dataStorage: DataStorage,
    anonymousFsApiClient: AnonymousApiClient,
    authenticatedFsApiClient: AuthenticatedApiClient
  ) {
    this.dataStorage = dataStorage;
    this.anonymousFsApiClient = anonymousFsApiClient;
    this.authenticatedFsApiClient = authenticatedFsApiClient;
  }

  // New method for the page to add a memorial ID that was found on the page
  public async addMemorialId(memorialId: string): Promise<Memorial> {
    let memorial = this.memorials.get(memorialId);
    
    if (!memorial) {
      const data = await this.dataStorage.getFindAGraveMemorialData(memorialId) || new FindAGraveMemorialData();
      memorial = {
        memorialId,
        data,
        isProcessing: false
      };
      this.memorials.set(memorialId, memorial);
      
      // Queue for update if needed
      if (memorial.data.recordIdStatus === IdStatus.UNKNOWN || 
          (memorial.data.recordIdStatus === IdStatus.FOUND && memorial.data.personIdStatus === IdStatus.UNKNOWN)) {
        this.queueForUpdate(memorial.memorialId);
      }
    }
    
    return memorial;
  }
  
  // New method for the page to manually trigger an update (refresh button)
  public triggerMemorialUpdate(memorialId: string): void {
    this.processMemorial(memorialId, true);
  }

  // Get a record search URL for a memorial
  public getRecordSearchUrl(memorialId: string): string {
    return `https://www.familysearch.org/en/search/record/results?f.collectionId=${FINDAGRAVE_COLLECTION_ID}&q.externalRecordId=${memorialId}&click-first-result=true`;
  }

  // #region Private helpers
  
  private queueForUpdate(memorialId: string): void {
    if (!this.memorialUpdateQueue.includes(memorialId)) {
      this.memorialUpdateQueue.push(memorialId);
      this.processMemorialUpdateQueue();
    }
  }
  
  private async processMemorialUpdateQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }
    
    this.isProcessingQueue = true;
    try {
      while (this.memorialUpdateQueue.length > 0) {
        const memorialId = this.memorialUpdateQueue.shift()!;
        await this.processMemorial(memorialId);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  // Process a single memorial
  private async processMemorial(memorialId: string, forceLookup = false): Promise<void> {
    const memorial = this.memorials.get(memorialId);
    if (!memorial) return;
    
    // Signal the start of processing
    memorial.isProcessing = true;
    const processingStartMs = Date.now();
    this.onMemorialUpdateStart?.(memorialId);
    
    try {
      if (forceLookup || memorial.data.recordIdStatus === IdStatus.UNKNOWN) {
        await this.lookupRecordId(memorial);
        this.onMemorialDataUpdate?.(memorialId, memorial.data);
      }
      
      if (forceLookup || (memorial.data.recordIdStatus === IdStatus.FOUND && memorial.data.personIdStatus === IdStatus.UNKNOWN)) {
        await this.lookupPersonId(memorial);
        this.onMemorialDataUpdate?.(memorialId, memorial.data);
      }
      
      // Wait if needed
      const elapsedTime = Date.now() - processingStartMs;
      const processingStopSignalDelay = Math.max(0, FindAGraveMemorialUpdater.MIN_PROCESSING_TIME_MS - elapsedTime);
      if (processingStopSignalDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, processingStopSignalDelay));
      }
    } catch (error) {
      Logger.error(`Error processing memorial ${memorialId}`, error);
    } finally {
      // Always signal completion
      memorial.isProcessing = false;
      this.onMemorialUpdateEnd?.(memorialId);
    }
  }

  private async lookupRecordId(memorial: Memorial): Promise<void> {
    try {
      Logger.debug(`Looking up record ID for memorial ${memorial.memorialId}`, memorial);
      const searchRecordsResponse = await this.anonymousFsApiClient.searchRecords(new URLSearchParams({
        'q.externalRecordId': memorial.memorialId,
        'f.collectionId': FINDAGRAVE_COLLECTION_ID
      }));
      
      const recordsCount = searchRecordsResponse?.entries?.length || 0;
      if (recordsCount > 1) {
        await this.anonymousFsApiClient.fetchNewAnonymousSessionId();
        throw new Error('Search returned multiple records. This is likely because we hit the API too fast. Take a break for a few minutes and refresh the page');
      }

      if (recordsCount === 0) {
        memorial.data.recordId = undefined;
        memorial.data.recordIdStatus = IdStatus.NONE;
      } else {
        const recordId = searchRecordsResponse.entries[0].id;
        memorial.data.recordId = recordId;
        memorial.data.recordIdStatus = IdStatus.FOUND;
      }
      await this.dataStorage.setFindAGraveMemorialData(memorial.memorialId, memorial.data);
    } catch (error) {
      Logger.error(`Error looking up record ID for memorial ${memorial.memorialId}`, error);
      throw error;
    }
  }

  private async lookupPersonId(memorial: Memorial): Promise<void> {
    try {
      if (!await this.dataStorage.getAuthenticatedSession()) return;

      Logger.debug(`Looking up person ID for memorial ${memorial.memorialId}`, memorial);
      const attachments = await this.authenticatedFsApiClient.getAttachmentsForRecord(memorial.data.recordId!);
      if (attachments && attachments.length > 0 && attachments[0].persons?.length > 0) {
        const personId = attachments[0].persons[0].entityId;
        memorial.data.personId = personId;
        memorial.data.personIdStatus = IdStatus.FOUND;
      } else {
        memorial.data.personId = undefined;
        memorial.data.personIdStatus = IdStatus.NONE;
      }
      await this.dataStorage.setFindAGraveMemorialData(memorial.memorialId, memorial.data);
    } catch (error) {
      Logger.error(`Error looking up person ID for memorial ${memorial.memorialId}`, error);
      throw error;
    }
  }

  // #endregion
}