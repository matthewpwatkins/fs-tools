export enum IdStatus {
  UNKNOWN = 'UNKNOWN', // Not yet searched
  NONE = 'NONE',       // Searched but not found
  FOUND = 'FOUND'      // Searched and found
}

export class FindAGraveMemorialData {
  public recordIdStatus: IdStatus = IdStatus.UNKNOWN;
  public recordId?: string = undefined;
  public personIdStatus: IdStatus = IdStatus.UNKNOWN;
  public personId?: string = undefined;

  constructor() {}
}
