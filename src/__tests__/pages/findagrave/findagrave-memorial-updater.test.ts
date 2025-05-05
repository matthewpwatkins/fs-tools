import { FindAGraveMemorialUpdater, Memorial } from '../../../pages/findagrave/findagrave-memorial-updater';
import { DataStorage } from '../../../data/data-storage';
import { FindAGraveMemorialData, IdStatus } from '../../../data/models/findagrave-memorial-data';
import { AnonymousApiClient } from '../../../fs-api/anonymous-api-client';
import { AuthenticatedApiClient } from '../../../fs-api/authenticated-api-client';
import { FINDAGRAVE_COLLECTION_ID } from '../../../constants';

// Mock dependencies
jest.mock('../../../data/data-storage');
jest.mock('../../../fs-api/anonymous-api-client');
jest.mock('../../../fs-api/authenticated-api-client');

describe('FindAGraveMemorialUpdater', () => {
  let updater: FindAGraveMemorialUpdater;
  let mockDataStorage: jest.Mocked<DataStorage>;
  let mockAnonymousApiClient: jest.Mocked<AnonymousApiClient>;
  let mockAuthenticatedApiClient: jest.Mocked<AuthenticatedApiClient>;
  
  const testMemorialId = '123456789';
  const testRecordId = 'record-123';
  const testPersonId = 'person-123';
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.resetAllMocks();
    
    // Setup mock implementations
    mockDataStorage = {
      getFindAGraveMemorialData: jest.fn(),
      setFindAGraveMemorialData: jest.fn().mockResolvedValue(undefined),
      getAuthenticatedSession: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<DataStorage>;
    
    mockAnonymousApiClient = {
      searchRecords: jest.fn(),
      fetchNewAnonymousSessionId: jest.fn(),
    } as unknown as jest.Mocked<AnonymousApiClient>;
    
    mockAuthenticatedApiClient = {
      getAttachmentsForRecord: jest.fn(),
    } as unknown as jest.Mocked<AuthenticatedApiClient>;
    
    // Create the updater with mocks and zero minimum processing time
    updater = new FindAGraveMemorialUpdater(
      mockDataStorage,
      mockAnonymousApiClient,
      mockAuthenticatedApiClient,
      0, // No delay for tests
      1
    );
    
    // Mock Date.now to control timing
    jest.spyOn(Date, 'now').mockImplementation(() => 1000);
    
    // Mock setTimeout to avoid actual timeouts
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  describe('addMemorialId', () => {
    it('should create a new memorial with data from storage', async () => {
      // Mock data storage returning some data
      const mockData = new FindAGraveMemorialData();
      mockData.recordIdStatus = IdStatus.FOUND;
      mockData.personIdStatus = IdStatus.FOUND;
      mockDataStorage.getFindAGraveMemorialData.mockResolvedValue(mockData);
      
      // Call the method
      const result = await updater.addMemorialId(testMemorialId);
      
      // Verify results
      expect(mockDataStorage.getFindAGraveMemorialData).toHaveBeenCalledWith(testMemorialId);
      expect(result).toEqual({
        memorialId: testMemorialId,
        data: mockData,
        isProcessing: false
      });
    });
    
    it('should create a new memorial with default data if not in storage', async () => {
      // Mock data storage returning nothing
      mockDataStorage.getFindAGraveMemorialData.mockResolvedValue(undefined);
      
      // Mock queueForUpdate to prevent it from actually running and changing isProcessing
      jest.spyOn(updater as any, 'queueForUpdate').mockImplementation(() => {});
      
      // Call the method
      const result = await updater.addMemorialId(testMemorialId);
      
      // Verify results
      expect(mockDataStorage.getFindAGraveMemorialData).toHaveBeenCalledWith(testMemorialId);
      expect(result.memorialId).toBe(testMemorialId);
      expect(result.data).toBeInstanceOf(FindAGraveMemorialData);
      expect(result.isProcessing).toBe(false);
    });
    
    it('should queue for update if record ID status is unknown', async () => {
      // Setup spy on private method
      const queueSpy = jest.spyOn(updater as any, 'queueForUpdate');
      queueSpy.mockImplementation(() => {}); // Mock to prevent actual execution
      
      // Mock data with unknown record ID
      const mockData = new FindAGraveMemorialData();
      mockData.recordIdStatus = IdStatus.UNKNOWN;
      mockDataStorage.getFindAGraveMemorialData.mockResolvedValue(mockData);
      
      // Call the method
      await updater.addMemorialId(testMemorialId);
      
      // Verify it was queued
      expect(queueSpy).toHaveBeenCalledWith(testMemorialId);
    });
    
    it('should queue for update if record found but person ID unknown', async () => {
      // Setup spy on private method
      const queueSpy = jest.spyOn(updater as any, 'queueForUpdate');
      queueSpy.mockImplementation(() => {}); // Mock to prevent actual execution
      
      // Mock data with known record but unknown person
      const mockData = new FindAGraveMemorialData();
      mockData.recordIdStatus = IdStatus.FOUND;
      mockData.personIdStatus = IdStatus.UNKNOWN;
      mockDataStorage.getFindAGraveMemorialData.mockResolvedValue(mockData);
      
      // Call the method
      await updater.addMemorialId(testMemorialId);
      
      // Verify it was queued
      expect(queueSpy).toHaveBeenCalledWith(testMemorialId);
    });
    
    it('should not queue for update if both record and person are found', async () => {
      // Setup spy on private method
      const queueSpy = jest.spyOn(updater as any, 'queueForUpdate');
      
      // Mock data with both IDs found
      const mockData = new FindAGraveMemorialData();
      mockData.recordIdStatus = IdStatus.FOUND;
      mockData.personIdStatus = IdStatus.FOUND;
      mockDataStorage.getFindAGraveMemorialData.mockResolvedValue(mockData);
      
      // Call the method
      await updater.addMemorialId(testMemorialId);
      
      // Verify it wasn't queued
      expect(queueSpy).not.toHaveBeenCalled();
    });
  });
  
  describe('triggerMemorialUpdate', () => {
    it('should process a memorial when triggered manually', async () => {
      // Setup spy on private method
      const processSpy = jest.spyOn(updater as any, 'processMemorial');
      
      // Call the method
      updater.triggerMemorialUpdate(testMemorialId);
      
      // Verify process was called with force=true
      expect(processSpy).toHaveBeenCalledWith(testMemorialId, true);
    });
  });
  
  describe('getRecordSearchUrl', () => {
    it('should return correct search URL for a memorial ID', () => {
      const url = updater.getRecordSearchUrl(testMemorialId);
      expect(url).toBe(`https://www.familysearch.org/en/search/record/results?f.collectionId=${FINDAGRAVE_COLLECTION_ID}&q.externalRecordId=${testMemorialId}&click-first-result=true`);
    });
  });
  
  describe('processMemorial', () => {
    beforeEach(() => {
      // Setup a memorial in the updater
      const memorial: Memorial = {
        memorialId: testMemorialId,
        data: new FindAGraveMemorialData(),
        isProcessing: false
      };
      (updater as any).memorials.set(testMemorialId, memorial);
      
      // Setup event handlers
      updater.onMemorialUpdateStart = jest.fn();
      updater.onMemorialDataUpdate = jest.fn();
      updater.onMemorialUpdateEnd = jest.fn();
    });
    
    it('should look up record ID when status is unknown', async () => {
      // Setup memorial with unknown record ID
      const memorial = (updater as any).memorials.get(testMemorialId);
      memorial.data.recordIdStatus = IdStatus.UNKNOWN;
      
      // Mock API response with a record - adding required 'hints' property
      mockAnonymousApiClient.searchRecords.mockResolvedValue({
        entries: [{ 
          id: testRecordId,
          hints: [] // Add required hints property
        }]
      });
      
      // Call the private method directly
      await (updater as any).processMemorial(testMemorialId);
      
      // Verify record lookup was called
      expect(mockAnonymousApiClient.searchRecords).toHaveBeenCalled();
      expect(mockDataStorage.setFindAGraveMemorialData).toHaveBeenCalled();
      expect(updater.onMemorialUpdateStart).toHaveBeenCalledWith(testMemorialId);
      expect(updater.onMemorialDataUpdate).toHaveBeenCalled();
      expect(updater.onMemorialUpdateEnd).toHaveBeenCalledWith(testMemorialId);
      
      // Verify memorial was updated
      expect(memorial.data.recordId).toBe(testRecordId);
      expect(memorial.data.recordIdStatus).toBe(IdStatus.FOUND);
    });
    
    it('should look up person ID when record is found but person is unknown', async () => {
      // Setup memorial with found record but unknown person
      const memorial = (updater as any).memorials.get(testMemorialId);
      memorial.data.recordId = testRecordId;
      memorial.data.recordIdStatus = IdStatus.FOUND;
      memorial.data.personIdStatus = IdStatus.UNKNOWN;
      
      // Mock API response with a person - adding required 'sourceId' property
      mockAuthenticatedApiClient.getAttachmentsForRecord.mockResolvedValue([
        {
          sourceId: 'source-123',  // Add required sourceId property
          persons: [{ entityId: testPersonId }]
        }
      ]);
      
      // Call the private method directly
      await (updater as any).processMemorial(testMemorialId);
      
      // Verify person lookup was called
      expect(mockAuthenticatedApiClient.getAttachmentsForRecord).toHaveBeenCalledWith(testRecordId);
      expect(mockDataStorage.setFindAGraveMemorialData).toHaveBeenCalled();
      
      // Verify memorial was updated
      expect(memorial.data.personId).toBe(testPersonId);
      expect(memorial.data.personIdStatus).toBe(IdStatus.FOUND);
    });
    
    it('should set record status to NONE when no records found', async () => {
      // Setup memorial with unknown record ID
      const memorial = (updater as any).memorials.get(testMemorialId);
      memorial.data.recordIdStatus = IdStatus.UNKNOWN;
      
      // Mock API response with no records
      mockAnonymousApiClient.searchRecords.mockResolvedValue({
        entries: []
      });
      
      // Call the private method directly
      await (updater as any).processMemorial(testMemorialId);
      
      // Verify memorial was updated correctly
      expect(memorial.data.recordId).toBeUndefined();
      expect(memorial.data.recordIdStatus).toBe(IdStatus.NONE);
    });
    
    it('should set person status to NONE when record has no person attached', async () => {
      // Setup memorial with found record but unknown person
      const memorial = (updater as any).memorials.get(testMemorialId);
      memorial.data.recordId = testRecordId;
      memorial.data.recordIdStatus = IdStatus.FOUND;
      memorial.data.personIdStatus = IdStatus.UNKNOWN;
      
      // Mock API response with no persons - adding required 'sourceId' property
      mockAuthenticatedApiClient.getAttachmentsForRecord.mockResolvedValue([
        { 
          sourceId: 'source-123',  // Add required sourceId property
          persons: [] 
        }
      ]);
      
      // Call the private method directly
      await (updater as any).processMemorial(testMemorialId);
      
      // Verify memorial was updated correctly
      expect(memorial.data.personId).toBeUndefined();
      expect(memorial.data.personIdStatus).toBe(IdStatus.NONE);
    });
    
    it('should handle errors during record lookup', async () => {
      // Setup memorial with unknown record ID
      const memorial = (updater as any).memorials.get(testMemorialId);
      memorial.data.recordIdStatus = IdStatus.UNKNOWN;
      
      // Mock API error
      const testError = new Error('API error');
      mockAnonymousApiClient.searchRecords.mockRejectedValue(testError);
      
      // Mock console.error to prevent test output clutter
      jest.spyOn(console, 'error').mockImplementation();
      
      // Call the private method directly
      await (updater as any).processMemorial(testMemorialId);
      
      // Verify error handling
      expect(updater.onMemorialUpdateStart).toHaveBeenCalledWith(testMemorialId);
      expect(updater.onMemorialUpdateEnd).toHaveBeenCalledWith(testMemorialId);
      expect(memorial.isProcessing).toBe(false);
    });
    
    it('should not delay when minProcessingTimeMs is set to 0', async () => {
      // Setup memorial
      const memorial = (updater as any).memorials.get(testMemorialId);
      memorial.data.recordIdStatus = IdStatus.FOUND;
      memorial.data.personIdStatus = IdStatus.FOUND;
      
      // Track setTimeout calls
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      
      // Call the private method directly
      await (updater as any).processMemorial(testMemorialId);
      
      // Verify setTimeout was not called (no delay)
      expect(setTimeoutSpy).not.toHaveBeenCalled();
    });
  });
});
