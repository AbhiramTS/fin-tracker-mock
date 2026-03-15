import type { ChangeRecord, PushResult } from "@/types";

export abstract class SyncAdapter {
  abstract pushChanges(changes: ChangeRecord[]): Promise<PushResult>;
  abstract pullEntity(entity: string): Promise<Record<string, unknown>[]>;
  async prepare(): Promise<void> {}
  destroy(): void {}
}

export class RestSyncAdapter extends SyncAdapter {
  constructor(private readonly baseUrl: string, private readonly token?: string) { super(); }
  private h() { return { "Content-Type": "application/json", ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }; }
  async pushChanges(changes: ChangeRecord[]): Promise<PushResult> {
    const r = await fetch(`${this.baseUrl.replace(/\/$/, "")}/sync/push`, { method: "POST", headers: this.h(), body: JSON.stringify({ changes }) });
    if (!r.ok) throw new Error(`Push failed: ${r.status}`);
    return r.json() as Promise<PushResult>;
  }
  async pullEntity(entity: string): Promise<Record<string, unknown>[]> {
    const r = await fetch(`${this.baseUrl.replace(/\/$/, "")}/sync/pull/${entity}`, { headers: this.h() });
    if (!r.ok) throw new Error(`Pull failed: ${r.status}`);
    return r.json() as Promise<Record<string, unknown>[]>;
  }
}
