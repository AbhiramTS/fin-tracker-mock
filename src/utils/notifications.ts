const ENABLED_KEY = 'ft_browser_notifications_enabled';

export interface BrowserNotificationPayload {
	title: string;
	body?: string;
	tag?: string;
	url?: string;
}

export function isBrowserNotificationSupported(): boolean {
	return typeof window !== 'undefined' && 'Notification' in window;
}

export function hasServiceWorkerSupport(): boolean {
	return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

export function isPushSupported(): boolean {
	return hasServiceWorkerSupport() && 'PushManager' in window;
}

export function getBrowserNotificationPermission(): NotificationPermission {
	if (!isBrowserNotificationSupported()) return 'denied';
	return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
	if (!isBrowserNotificationSupported()) return 'denied';
	return Notification.requestPermission();
}

export function getBrowserNotificationsEnabled(): boolean {
	return localStorage.getItem(ENABLED_KEY) === '1';
}

export function setBrowserNotificationsEnabled(enabled: boolean): void {
	if (enabled) localStorage.setItem(ENABLED_KEY, '1');
	else localStorage.removeItem(ENABLED_KEY);
}

export async function showBrowserNotification(payload: BrowserNotificationPayload): Promise<boolean> {
	if (!isBrowserNotificationSupported()) return false;
	if (Notification.permission !== 'granted') return false;
	const defaultUrl = `${import.meta.env.BASE_URL}#/dashboard`;

	const options: NotificationOptions = {
		body: payload.body,
		tag: payload.tag,
		icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
		badge: `${import.meta.env.BASE_URL}icons/icon-192.png`,
		data: { url: payload.url ?? defaultUrl },
	};

	if (hasServiceWorkerSupport()) {
		const registration = await navigator.serviceWorker.getRegistration();
		if (registration) {
			await registration.showNotification(payload.title, options);
			return true;
		}
	}

	new Notification(payload.title, options);
	return true;
}

function base64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
	return outputArray;
}

export async function ensurePushSubscription(
	vapidPublicKey: string | undefined
): Promise<{ ok: boolean; reason?: string; endpoint?: string }> {
	if (!isPushSupported()) return { ok: false, reason: 'Push API not supported on this device.' };
	if (!vapidPublicKey) {
		return {
			ok: false,
			reason: 'Missing VITE_VAPID_PUBLIC_KEY. Add it to enable push subscriptions.',
		};
	}

	const permission = await requestBrowserNotificationPermission();
	if (permission !== 'granted') return { ok: false, reason: 'Notification permission not granted.' };

	const registration = await navigator.serviceWorker.ready;
	let subscription = await registration.pushManager.getSubscription();
	if (!subscription) {
		subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: base64ToUint8Array(vapidPublicKey),
		});
	}

	return { ok: true, endpoint: subscription.endpoint };
}
