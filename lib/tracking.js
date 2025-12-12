// Client-side behavior tracking utility

class BehaviorTracker {
  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.queue = [];
    this.isOnline = true;
    
    // Setup online/offline handlers
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.flushQueue();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }

  getOrCreateSessionId() {
    if (typeof window === 'undefined') return null;
    
    let sessionId = sessionStorage.getItem('behavior_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('behavior_session_id', sessionId);
    }
    return sessionId;
  }

  async track(actionType, actionTarget = null, actionValue = null, metadata = {}) {
    const event = {
      actionType,
      actionTarget,
      actionValue,
      metadata: {
        ...metadata,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        url: typeof window !== 'undefined' ? window.location.href : null,
        referrer: typeof document !== 'undefined' ? document.referrer : null
      }
    };

    if (this.isOnline) {
      try {
        await this.sendEvent(event);
      } catch (error) {
        console.warn('Failed to track behavior, adding to queue:', error);
        this.queue.push(event);
      }
    } else {
      this.queue.push(event);
    }
  }

  async sendEvent(event) {
    const response = await fetch('/api/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  async flushQueue() {
    if (this.queue.length === 0) return;
    
    const eventsToSend = [...this.queue];
    this.queue = [];

    for (const event of eventsToSend) {
      try {
        await this.sendEvent(event);
      } catch (error) {
        console.warn('Failed to send queued event:', error);
        this.queue.push(event); // Re-queue failed events
      }
    }
  }

  // Specific tracking methods for common actions
  trackNavigation(section, fromSection = null) {
    this.track('navigation', section, fromSection, {
      action: 'section_change'
    });
  }

  trackFilterChange(filterType, newValue, oldValue = null) {
    this.track('filter_change', filterType, newValue, {
      oldValue,
      action: 'filter_update'
    });
  }

  trackSearch(searchTerm, resultCount = null) {
    this.track('search', 'submission', searchTerm, {
      resultCount,
      action: 'search_submission'
    });
  }

  trackButtonClick(buttonType, buttonValue = null) {
    this.track('button_click', buttonType, buttonValue, {
      action: 'ui_interaction'
    });
  }

  trackPageView(page) {
    this.track('page_view', page, null, {
      action: 'page_access'
    });
  }

  trackLanguageChange(newLang, oldLang) {
    this.track('language_change', 'ui_language', newLang, {
      oldValue: oldLang,
      action: 'settings_change'
    });
  }

  trackThemeChange(newTheme, oldTheme) {
    this.track('theme_change', 'ui_theme', newTheme, {
      oldValue: oldTheme,
      action: 'settings_change'
    });
  }

  trackAuth(action, provider = null) {
    this.track('auth', action, provider, {
      action: 'authentication'
    });
  }
}

// Create singleton instance
export const tracker = new BehaviorTracker();

// Export individual tracking functions for convenience
export const trackNavigation = (section, fromSection) => tracker.trackNavigation(section, fromSection);
export const trackFilterChange = (filterType, newValue, oldValue) => tracker.trackFilterChange(filterType, newValue, oldValue);
export const trackSearch = (searchTerm, resultCount) => tracker.trackSearch(searchTerm, resultCount);
export const trackButtonClick = (buttonType, buttonValue) => tracker.trackButtonClick(buttonType, buttonValue);
export const trackPageView = (page) => tracker.trackPageView(page);
export const trackLanguageChange = (newLang, oldLang) => tracker.trackLanguageChange(newLang, oldLang);
export const trackThemeChange = (newTheme, oldTheme) => tracker.trackThemeChange(newTheme, oldTheme);
export const trackAuth = (action, provider) => tracker.trackAuth(action, provider);

export default tracker;