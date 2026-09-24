import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { CodebookSnapshot, CodebookVariable } from '../types';

interface AIDataExtractorDBSchema extends DBSchema {
  settings: {
    key: string;
    value: any;
  };
  codebook_snapshots: {
    key: string;
    value: CodebookSnapshot;
    indexes: { 'by-timestamp': string };
  };
  manuscripts: {
    key: string;
    value: {
      filename: string;
      data: ArrayBuffer;
      type: 'pdf' | 'docx';
      uploadedAt: string;
    };
  };
  extractions: {
    key: string;
    value: {
      id: string;
      timestamp: string;
      data: any;
    };
  };
}

const DB_NAME = 'AIDataExtractorDB_v2';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AIDataExtractorDBSchema>> | null = null;

export function getDatabase(): Promise<IDBPDatabase<AIDataExtractorDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AIDataExtractorDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
        if (!db.objectStoreNames.contains('codebook_snapshots')) {
          const store = db.createObjectStore('codebook_snapshots', { keyPath: 'id' });
          store.createIndex('by-timestamp', 'timestamp');
        }
        if (!db.objectStoreNames.contains('manuscripts')) {
          db.createObjectStore('manuscripts', { keyPath: 'filename' });
        }
        if (!db.objectStoreNames.contains('extractions')) {
          db.createObjectStore('extractions', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// Settings Persistence
export async function saveSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDatabase();
  await db.put('settings', value, key);
}

export async function loadSetting<T>(key: string, defaultValue: T): Promise<T> {
  const db = await getDatabase();
  const val = await db.get('settings', key);
  return val !== undefined ? val : defaultValue;
}

// Codebook Snapshot Versioning (Audit Trail)
export async function saveCodebookSnapshot(
  variables: CodebookVariable[],
  source: string = 'Manual Edit',
  note: string = ''
): Promise<CodebookSnapshot> {
  const db = await getDatabase();
  const snapshot: CodebookSnapshot = {
    id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    source,
    note: note || `Snapshot created via ${source}`,
    variables: JSON.parse(JSON.stringify(variables)),
  };
  await db.put('codebook_snapshots', snapshot);
  return snapshot;
}

export async function listCodebookSnapshots(): Promise<CodebookSnapshot[]> {
  const db = await getDatabase();
  const tx = db.transaction('codebook_snapshots', 'readonly');
  const index = tx.store.index('by-timestamp');
  const snapshots = await index.getAll();
  return snapshots.reverse(); // Newest first
}

export async function deleteCodebookSnapshot(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete('codebook_snapshots', id);
}

// Manuscript Storage
export async function storeManuscriptFile(filename: string, file: File): Promise<void> {
  const db = await getDatabase();
  const buffer = await file.arrayBuffer();
  await db.put('manuscripts', {
    filename,
    data: buffer,
    type: filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx',
    uploadedAt: new Date().toISOString(),
  });
}

export async function getManuscriptFile(filename: string): Promise<{ data: ArrayBuffer; type: 'pdf' | 'docx' } | null> {
  const db = await getDatabase();
  const entry = await db.get('manuscripts', filename);
  return entry ? { data: entry.data, type: entry.type } : null;
}

export async function listStoredManuscripts(): Promise<string[]> {
  const db = await getDatabase();
  return db.getAllKeys('manuscripts') as Promise<string[]>;
}

export async function removeManuscriptFile(filename: string): Promise<void> {
  const db = await getDatabase();
  await db.delete('manuscripts', filename);
}
