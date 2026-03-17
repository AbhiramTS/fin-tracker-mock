import { dbGetAll, dbPut, dbDelete } from '@/db/indexedDB';
import { enqueueChange } from '@/sync/syncQueue';
import { generateId } from '@/utils/id';
import type { BaseRecord } from '@/types';

export class BaseRepository<T extends BaseRecord> {
	constructor(protected readonly storeName: string) {}

	getAll(): Promise<T[]> {
		return dbGetAll<T>(this.storeName);
	}

	async save(
		record: Omit<T, 'id' | 'createdAt' | 'updatedAt'> &
			Partial<Pick<T, 'id' | 'createdAt' | 'updatedAt'>>
	): Promise<T> {
		const isNew = !record.id;
		const saved = {
			...record,
			id: record.id ?? generateId(),
			createdAt: (record as Partial<BaseRecord>).createdAt ?? new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		} as T;
		await dbPut(this.storeName, saved);
		await enqueueChange({
			entity: this.storeName,
			type: isNew ? 'create' : 'update',
			payload: saved as unknown as Record<string, unknown>,
		});
		return saved;
	}

	async delete(id: string): Promise<string> {
		await dbDelete(this.storeName, id);
		await enqueueChange({
			entity: this.storeName,
			type: 'delete',
			payload: { id },
		});
		return id;
	}
}
