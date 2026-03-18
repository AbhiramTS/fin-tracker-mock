/**
 * Register the service worker and handle updates gracefully.
 *
 * When a new SW is found:
 *   - Tell it to skip waiting immediately (activates the new SW)
 *   - Once the new SW takes control, reload the page so users always
 *     see the latest build rather than a stale cached version.
 */
export function registerServiceWorker(): void {
	if (!('serviceWorker' in navigator)) return;

	window.addEventListener('load', async () => {
		try {
			const registration = await navigator.serviceWorker.register('/sw.js');
			console.info('[SW] registered:', registration.scope);

			// Handle the case where there's already a waiting SW on first load
			if (registration.waiting) {
				activateWaiting(registration);
			}

			// Watch for a new SW found after initial registration
			registration.addEventListener('updatefound', () => {
				const newWorker = registration.installing;
				if (!newWorker) return;

				newWorker.addEventListener('statechange', () => {
					if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
						// A new SW has installed alongside the active one — activate it now
						console.info('[SW] new version available, activating…');
						activateWaiting(registration);
					}
				});
			});

			// When the SW changes (new one takes control), reload all clients
			let reloading = false;
			navigator.serviceWorker.addEventListener('controllerchange', () => {
				if (reloading) return;
				reloading = true;
				console.info('[SW] controller changed — reloading for fresh content');
				window.location.reload();
			});
		} catch (err) {
			console.warn('[SW] registration failed:', err);
		}
	});
}

function activateWaiting(registration: ServiceWorkerRegistration): void {
	if (registration.waiting) {
		registration.waiting.postMessage('SKIP_WAITING');
	}
}
