// ─────────────────────────────────────────────────────────────────────────────
//  sync/FirebaseSyncAdapter.ts
//  Firestore real-time sync adapter.
//  - Offline-first: writes always go to IndexedDB first via SyncQueue.
//  - Firebase is the cloud layer only, never the primary store.
//  - onSnapshot subscriptions keep IDB up-to-date in real time.
//  - Firebase SDK is imported at build-time (package.json dependency).
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getFirestore, collection, doc, writeBatch,
  getDocs, onSnapshot,
  type Firestore, type Unsubscribe,
} from "firebase/firestore";

import { SyncAdapter }           from "./SyncAdapter";
import { dbPut, dbDelete, STORE_DEFS } from "@/db/indexedDB";
import type { ChangeRecord, PushResult, FirebaseConfig } from "@/types";

type ReloadCallback = (entity: string) => void;

export class FirebaseSyncAdapter extends SyncAdapter {
  private app:    FirebaseApp  | null = null;
  private db:     Firestore    | null = null;
  private unsubs: Unsubscribe[]       = [];

  constructor(private readonly config: FirebaseConfig) { super(); }

  async prepare(): Promise<void> {
    if (this.db) return;
    this.app = getApps().length ? getApp() : initializeApp(this.config);
    this.db  = getFirestore(this.app);
  }

  async pushChanges(changes: ChangeRecord[]): Promise<PushResult> {
    await this.prepare();
    const db     = this.db!;
    const batch  = writeBatch(db);
    const synced: string[] = [];
    const ENTITIES = Object.keys(STORE_DEFS).filter((s) => s !== "syncQueue");

    for (const change of changes) {
      if (!ENTITIES.includes(change.entity)) {
        synced.push(change.queueId);
        continue;
      }
      const ref = doc(collection(db, change.entity), change.payload["id"] as string);
      if (change.type === "delete") {
        batch.delete(ref);
      } else {
        batch.set(ref, change.payload, { merge: true });
      }
      synced.push(change.queueId);
    }

    await batch.commit();
    return { synced, failed: [] };
  }

  async pullEntity(entity: string): Promise<Record<string, unknown>[]> {
    await this.prepare();
    const snap = await getDocs(collection(this.db!, entity));
    return snap.docs.map((d) => d.data() as Record<string, unknown>);
  }

  /**
   * Subscribe to real-time Firestore updates for every entity.
   * Incoming changes are written straight to IndexedDB so the UI
   * can reload from its local store.
   */
  async subscribeRealtime(onReload: ReloadCallback): Promise<void> {
    await this.prepare();
    const db      = this.db!;
    const entities = Object.keys(STORE_DEFS).filter((s) => s !== "syncQueue");

    for (const entity of entities) {
      const unsub = onSnapshot(collection(db, entity), async (snap) => {
        for (const change of snap.docChanges()) {
          if (change.type === "removed") {
            await dbDelete(entity, change.doc.id);
          } else {
            await dbPut(entity, change.doc.data());
          }
        }
        onReload(entity);
      });
      this.unsubs.push(unsub);
    }
  }

  override destroy(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
  }
}
