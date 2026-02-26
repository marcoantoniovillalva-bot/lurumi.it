"use client";

/**
 * IndexedDB Utility for Lurumi
 * Persists large files (Blobs) which are not suitable for localStorage.
 */

const DB_NAME = 'luPDFDB';
const DB_VERSION = 2;
const STORES = {
    FILES: 'files',
    VIDEOS: 'videos' // We might not need Blobs for videos, but keeping for consistency with original
};

export class LurumiDB {
    private db: IDBDatabase | null = null;

    async open(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORES.FILES)) {
                    db.createObjectStore(STORES.FILES, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORES.VIDEOS)) {
                    db.createObjectStore(STORES.VIDEOS, { keyPath: 'id' });
                }
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onerror = () => reject(request.error);
        });
    }

    async getAllFiles(): Promise<any[]> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.FILES, 'readonly');
            const store = tx.objectStore(STORES.FILES);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveFile(record: any): Promise<void> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.FILES, 'readwrite');
            const store = tx.objectStore(STORES.FILES);
            // Clean up Blobs from record before saving if needed, but IDB supports Blobs
            const request = store.put(record);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getFile(id: string): Promise<any | null> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.FILES, 'readonly');
            const store = tx.objectStore(STORES.FILES);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteFile(id: string): Promise<void> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.FILES, 'readwrite');
            const store = tx.objectStore(STORES.FILES);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

export const luDB = new LurumiDB();
