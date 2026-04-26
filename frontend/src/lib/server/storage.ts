import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export interface StorageAdapter {
	put(tenant: string, filename: string, data: Buffer, mime: string): Promise<void>;
	url(tenant: string, filename: string): string;
	delete(tenant: string, filename: string): Promise<void>;
	exists(tenant: string, filename: string): boolean;
}

const STORAGE_ROOT = path.resolve(process.cwd(), 'storage/images');

export const local: StorageAdapter = {
	async put(tenant, filename, data) {
		const dir = path.join(STORAGE_ROOT, tenant);
		await mkdir(dir, { recursive: true });
		await writeFile(path.join(dir, filename), data);
	},
	url(tenant, filename) {
		return `/api/media/${tenant}/${encodeURIComponent(filename)}`;
	},
	delete(tenant, filename) {
		return unlink(path.join(STORAGE_ROOT, tenant, filename));
	},
	exists(tenant, filename) {
		return existsSync(path.join(STORAGE_ROOT, tenant, filename));
	},
};

// Active adapter — swap this export to switch to R2
export const storage: StorageAdapter = local;
