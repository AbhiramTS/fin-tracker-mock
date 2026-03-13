import { create } from 'qrcode';

export interface QRResult {
	matrix: number[][];
	size: number;
}

export function makeQR(text: string): QRResult | null {
	try {
		const qr = create(text, { errorCorrectionLevel: 'M' });
		const size = qr.modules.size;
		const data = qr.modules.data;
		const matrix: number[][] = [];
		for (let r = 0; r < size; r++) {
			const row: number[] = [];
			for (let c = 0; c < size; c++) row.push(data[r * size + c] ? 1 : 0);
			matrix.push(row);
		}
		return { matrix, size };
	} catch {
		return null;
	}
}
