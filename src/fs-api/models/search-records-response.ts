export type SearchRecordsResponse = {
  entries: SearchRecordsResponseEntry[];
};

export type SearchRecordsResponseEntry = {
  id: string;
  hints: SearchRecordsResponseEntryHint[];
};

export type SearchRecordsResponseEntryHint = {
  id: string;
  stars: number;
};