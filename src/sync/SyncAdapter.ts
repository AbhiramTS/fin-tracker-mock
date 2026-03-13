// ─────────────────────────────────────────────────────────────────────────────
//  sync/SyncAdapter.ts
//  Abstract SyncAdapter interface that all concrete adapters implement.
//  Concrete: RestSyncAdapter (generic REST), FirebaseSyncAdapter (own file).
// ─────────────────────────────────────────────────────────────────────────────

import type { ChangeRecord, PushResult } from "@/types";

export abstract class SyncAdapter {
  /** Push a batch of local changes to the remote. Returns which queueIds synced. */
  abstract pushChanges(changes: ChangeRecord[]): Promise<PushResult>;
  /** Pull all records for one entity from the remote. */
  abstract pullEntity(entity: string): Promise<Record<string, unknown>[]>;
  /** Optional async setup (e.g. lazy SDK loading). Called before first push. */
  async prepare(): Promise<void> { /* no-op by default */ }
  /** Teardown – unsubscribe listeners, release resources. */
  destroy(): void { /* no-op by default */ }
}

// ─────────────────────────────────────────────────────────────────────────────
//  RestSyncAdapter  –  plain HTTP backend
//  POST {baseUrl}/sync/push  body: { changes }  → { synced, failed }
//  GET  {baseUrl}/sync/pull/{entity}             → Record[]
// ─────────────────────────────────────────────────────────────────────────────

export class RestSyncAdapter extends SyncAdapter {
  private readonly baseUrl: string;
  private readonly token?: string;

  constructor({ baseUrl, token }: { baseUrl: string; token?: string }) {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token   = token;
  }

  private headers(): HeadersInit {
    return {
      "Content-Type": "application/json",
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
  }

  async pushChanges(changes: ChangeRecord[]): Promise<PushResult> {
    const res = await fetch(`${this.baseUrl}/sync/push`, {
      method:  "POST",
      headers: this.headers(),
      body:    JSON.stringify({ changes }),
    });
    if (!res.ok) throw new Error(`REST push failed: ${res.status}`);
    return res.json() as Promise<PushResult>;
  }

  async pullEntity(entity: string): Promise<Record<string, unknown>[]> {
    const res = await fetch(`${this.baseUrl}/sync/pull/${entity}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`REST pull failed: ${res.status}`);
    return res.json() as Promise<Record<string, unknown>[]>;
  }
}
