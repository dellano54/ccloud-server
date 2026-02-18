/**
 * File Sync Types
 * Represents versioned metadata changes returned by /files/sync
 */

/* ---------------------------------- */
/* Operation Types */
/* ---------------------------------- */

export type FileOperation = "insert" | "update" | "delete";

/* ---------------------------------- */
/* File Metadata Snapshot */
/* ---------------------------------- */

export interface FileSnapshot {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  creationDate: string; // ISO 8601 timestamp
  checksum: string;
}

/* ---------------------------------- */
/* Change Row Types */
/* ---------------------------------- */

/**
 * Insert or Update change
 */
export interface FileUpsertChange {
  version: number;
  file_id: string;
  op: "insert" | "update";
  snapshot: FileSnapshot;
}

/**
 * Delete change
 */
export interface FileDeleteChange {
  version: number;
  file_id: string;
  op: "delete";
  snapshot: null;
}

/**
 * Union type for all change events
 */
export type FileChangeRow = FileUpsertChange | FileDeleteChange;

/* ---------------------------------- */
/* Sync API Response */
/* ---------------------------------- */

export interface FileSyncResponse {
  rows: FileChangeRow[];
}

/* ---------------------------------- */
/* Optional Helper Type Guards */
/* ---------------------------------- */

export function isDeleteChange(
  row: FileChangeRow
): row is FileDeleteChange {
  return row.op === "delete";
}

export function isUpsertChange(
  row: FileChangeRow
): row is FileUpsertChange {
  return row.op === "insert" || row.op === "update";
}
