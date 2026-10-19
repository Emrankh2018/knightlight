export type DataErrorKind = 'network' | 'shape' | 'notfound';

/** Thrown when a data file cannot be fetched ('network'), does not exist (HTTP 404, 'notfound') or does not have the expected shape. */
export class DataError extends Error {
  readonly url: string;
  readonly kind: DataErrorKind;
  /** HTTP status when the server answered. */
  readonly status: number | null;
  constructor(kind: DataErrorKind, url: string, detail: string, status: number | null = null) {
    super(`${kind === 'shape' ? 'Unexpected data in' : 'Could not load'} ${url}: ${detail}`);
    this.name = 'DataError';
    this.kind = kind;
    this.url = url;
    this.status = status;
  }
}
