// Environment Variable Loader
// This module handles loading environment variables in the frontend

class EnvLoader {
    constructor() {
        this.env = {};
        this.loadFromMeta();
    }

    // Load environment variables from meta tags
    loadFromMeta() {
        const metaTags = document.querySelectorAll('meta[name^="env-"]');
        metaTags.forEach(tag => {
            const key = tag.getAttribute('name').replace('env-', '').toUpperCase();
            const value = tag.getAttribute('content');
            this.env[key] = value;
        });
    }

    // Get environment variable
    get(key) {
        return this.env[key] || null;
    }

    // Check if in development mode
    isDev() {
        return this.get('APP_ENV') === 'development';
    }

    // Check if in production mode
    isProd() {
        return this.get('APP_ENV') === 'production';
    }

    // Get Supabase URL
    getSupabaseUrl() {
        return this.get('SUPABASE_URL');
    }

    // Get Supabase Anon Key
    getSupabaseAnonKey() {
        return this.get('SUPABASE_ANON_KEY');
    }

    // Get Gemini API Key
    getGeminiApiKey() {
        return this.get('GEMINI_API_KEY');
    }

    // Get App URL
    getAppUrl() {
        return this.get('APP_URL') || window.location.origin;
    }
}

// Create global instance
const envLoader = new EnvLoader();

// Export for use in other modules
window.envLoader = envLoader;
