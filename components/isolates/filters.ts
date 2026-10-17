// Filter shape for /isolates (plain module so server pages can import the value).
export interface IsolateFilters {
  hn: string;
  organismId: string;
  wardId: string;
  status: string;
  reportStatus: string;
  from: string;
  to: string;
}
export const EMPTY_FILTERS: IsolateFilters = { hn: '', organismId: '', wardId: '', status: '', reportStatus: '', from: '', to: '' };
