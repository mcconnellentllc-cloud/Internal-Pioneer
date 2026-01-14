/**
 * Pioneer Analytics - API Client
 * Handles all communication with the backend server
 */

const API = {
    // Configuration
    baseUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? `${window.location.protocol}//${window.location.hostname}:3000`
        : window.location.origin,
    accessCode: 'pioneer2024',

    // State
    isOnline: true,
    lastSyncTime: null,

    /**
     * Make an authenticated API request
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}/api${endpoint}`;

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'X-Access-Code': this.accessCode
            }
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, mergedOptions);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            this.isOnline = true;
            return await response.json();
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                this.isOnline = false;
                throw new Error('API server not available');
            }
            throw error;
        }
    },

    /**
     * Check server health
     */
    async checkHealth() {
        try {
            const result = await this.request('/health');
            this.isOnline = true;
            return result;
        } catch (error) {
            this.isOnline = false;
            return { status: 'offline', error: error.message };
        }
    },

    /**
     * Authenticate with access code
     */
    async authenticate(accessCode) {
        return this.request('/auth', {
            method: 'POST',
            body: JSON.stringify({ accessCode })
        });
    },

    /**
     * Get all data from server
     */
    async getData() {
        const result = await this.request('/data');
        this.lastSyncTime = new Date();
        return result.data || [];
    },

    /**
     * Add a single record
     */
    async addRecord(record) {
        const result = await this.request('/data', {
            method: 'POST',
            body: JSON.stringify(record)
        });
        return result.data;
    },

    /**
     * Add multiple records (batch)
     */
    async addRecords(records) {
        const results = [];
        for (const record of records) {
            try {
                const result = await this.addRecord(record);
                results.push(result);
            } catch (error) {
                console.error('Failed to add record:', error);
            }
        }
        return results;
    },

    /**
     * Upload CSV file
     */
    async uploadCSV(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.baseUrl}/api/upload`, {
            method: 'POST',
            headers: {
                'X-Access-Code': this.accessCode
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return response.json();
    },

    /**
     * Delete all data
     */
    async clearData() {
        return this.request('/data', {
            method: 'DELETE'
        });
    },

    /**
     * Get analytics summary
     */
    async getAnalyticsSummary() {
        const result = await this.request('/analytics/summary');
        return result.summary;
    },

    /**
     * Get analytics by year
     */
    async getAnalyticsByYear(year) {
        const result = await this.request(`/analytics/by-year/${year}`);
        return result.summary;
    },

    /**
     * Get analytics by product
     */
    async getAnalyticsByProduct() {
        const result = await this.request('/analytics/by-product');
        return result.products;
    },

    /**
     * Get analytics by grower
     */
    async getAnalyticsByGrower() {
        const result = await this.request('/analytics/by-grower');
        return result.growers;
    },

    /**
     * Export data as CSV
     */
    async exportCSV(year = 'all') {
        const url = `${this.baseUrl}/api/export?year=${year}`;
        const response = await fetch(url, {
            headers: {
                'X-Access-Code': this.accessCode
            }
        });

        if (!response.ok) {
            throw new Error(`Export failed: HTTP ${response.status}`);
        }

        return response.blob();
    },

    /**
     * Sync local data to server
     */
    async syncToServer(localData) {
        if (!this.isOnline) {
            throw new Error('Server is offline');
        }

        // Get existing server data
        const serverData = await this.getData();
        const serverIds = new Set(serverData.map(d => d.id || d._id));

        // Find records that need to be synced
        const newRecords = localData.filter(d => !serverIds.has(d.id));

        if (newRecords.length > 0) {
            await this.addRecords(newRecords);
        }

        return {
            synced: newRecords.length,
            total: localData.length
        };
    },

    /**
     * Load initial data from grower_data.json
     */
    async loadGrowerDataJSON() {
        try {
            const response = await fetch('/data/grower_data.json');
            if (!response.ok) {
                throw new Error('Failed to load grower_data.json');
            }

            const jsonData = await response.json();
            const records = this.convertGrowerData(jsonData);

            return records;
        } catch (error) {
            console.error('Error loading grower_data.json:', error);
            return [];
        }
    },

    /**
     * Convert grower_data.json format to transaction format
     */
    convertGrowerData(jsonData) {
        const records = [];
        const pricePerBag = 280; // Default price per bag

        // Process each year
        for (const [year, yearData] of Object.entries(jsonData)) {
            if (year === 'hybrids' || year === 'traits') continue; // Skip metadata

            // Process corn data
            if (yearData.corn) {
                yearData.corn.forEach((entry, index) => {
                    records.push({
                        date: `${year}-03-15`, // Default to planting season
                        invoice_number: `PIO-${year}-${(index + 1).toString().padStart(4, '0')}`,
                        grower_name: entry.grower,
                        product: 'Corn Seed',
                        hybrid: entry.hybrid,
                        trait: entry.trait,
                        quantity: entry.bags,
                        amount: entry.bags * pricePerBag
                    });
                });
            }

            // Process soybean data if present
            if (yearData.soybean) {
                yearData.soybean.forEach((entry, index) => {
                    records.push({
                        date: `${year}-04-01`,
                        invoice_number: `PIO-SOY-${year}-${(index + 1).toString().padStart(4, '0')}`,
                        grower_name: entry.grower,
                        product: 'Soybean Seed',
                        hybrid: entry.hybrid,
                        trait: entry.trait,
                        quantity: entry.bags,
                        amount: entry.bags * 60 // Soybean price per unit
                    });
                });
            }
        }

        return records;
    }
};

// Export for use in app.js
window.API = API;
