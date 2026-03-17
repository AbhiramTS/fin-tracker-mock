import QRCode from 'qrcode';

export async function renderQR(canvas: HTMLCanvasElement, data: string, size = 220): Promise<void> {
	await QRCode.toCanvas(canvas, data, {
		width: size,
		margin: 1,
		color: { dark: '#000000', light: '#ffffff' },
		errorCorrectionLevel: 'M',
	});
}
