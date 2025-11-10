/**
 * Service for handling automatic app updates
 * Works with service worker to detect and apply updates automatically
 */

export class UpdateService {
  private static updateCheckInterval: NodeJS.Timeout | null = null;
  private static isCapacitor = false;

  /**
   * Initialize the update service
   * Checks if running in Capacitor and sets up automatic update checks
   */
  static async initialize(): Promise<void> {
    // Check if we're in Capacitor (native app)
    this.isCapacitor = !!(window as any).Capacitor;
    
    console.log('[UpdateService] Initializing...', {
      isCapacitor: this.isCapacitor,
      hasServiceWorker: 'serviceWorker' in navigator
    });

    if ('serviceWorker' in navigator) {
      // Listen for service worker updates
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[UpdateService] New service worker activated, reloading...');
        // New service worker has taken control, reload to get new content
        window.location.reload();
      });

      // Check for updates immediately
      await this.checkForUpdates();

      // Set up periodic checks (every 5 minutes when app is active)
      this.startPeriodicChecks();
    }
  }

  /**
   * Check for updates from the service worker
   */
  static async checkForUpdates(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      console.log('[UpdateService] Service worker not supported');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (!registration) {
        console.log('[UpdateService] No service worker registration found');
        return false;
      }

      // Manually trigger update check
      await registration.update();
      
      // Check if there's a waiting service worker
      if (registration.waiting) {
        console.log('[UpdateService] Update found! Activating...');
        // Tell the waiting service worker to skip waiting and become active
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        return true;
      }

      // Check if there's an installing service worker
      if (registration.installing) {
        console.log('[UpdateService] Update is installing...');
        return new Promise((resolve) => {
          registration.installing!.addEventListener('statechange', (e) => {
            const sw = e.target as ServiceWorker;
            if (sw.state === 'installed') {
              console.log('[UpdateService] Update installed! Activating...');
              sw.postMessage({ type: 'SKIP_WAITING' });
              resolve(true);
            }
          });
        });
      }

      console.log('[UpdateService] No updates available');
      return false;
    } catch (error) {
      console.error('[UpdateService] Error checking for updates:', error);
      return false;
    }
  }

  /**
   * Start periodic update checks
   * Checks every 5 minutes when app is in foreground
   */
  private static startPeriodicChecks(): void {
    // Clear any existing interval
    this.stopPeriodicChecks();

    // Check every 5 minutes
    this.updateCheckInterval = setInterval(() => {
      console.log('[UpdateService] Periodic update check...');
      this.checkForUpdates();
    }, 5 * 60 * 1000); // 5 minutes

    console.log('[UpdateService] Periodic checks started (every 5 minutes)');
  }

  /**
   * Stop periodic update checks
   */
  static stopPeriodicChecks(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
      console.log('[UpdateService] Periodic checks stopped');
    }
  }

  /**
   * Handle app resume (for Capacitor apps)
   * Checks for updates when app comes to foreground
   */
  static onAppResume(): void {
    console.log('[UpdateService] App resumed, checking for updates...');
    this.checkForUpdates();
  }

  /**
   * Handle app pause (for Capacitor apps)
   * Stops periodic checks to save battery
   */
  static onAppPause(): void {
    console.log('[UpdateService] App paused');
    // Keep checking even when paused, but service worker will handle it efficiently
  }

  /**
   * Clear all caches (use with caution)
   * Forces a fresh download of all assets
   */
  static async clearCaches(): Promise<void> {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('[UpdateService] All caches cleared');
    }
  }

  /**
   * Get current service worker state
   */
  static async getUpdateStatus(): Promise<{
    hasServiceWorker: boolean;
    hasUpdate: boolean;
    isInstalling: boolean;
    version?: string;
  }> {
    if (!('serviceWorker' in navigator)) {
      return { hasServiceWorker: false, hasUpdate: false, isInstalling: false };
    }

    const registration = await navigator.serviceWorker.getRegistration();
    
    if (!registration) {
      return { hasServiceWorker: false, hasUpdate: false, isInstalling: false };
    }

    return {
      hasServiceWorker: true,
      hasUpdate: !!registration.waiting,
      isInstalling: !!registration.installing,
      version: registration.active?.scriptURL
    };
  }
}
