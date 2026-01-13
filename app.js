/**
 * Pioneer Analytics - Grower Dashboard
 * Main Application JavaScript
 */

// ============================================
// CONFIGURATION & CONSTANTS
// ============================================
const CONFIG = {
    ACCESS_CODE: 'pioneer2024',
    STORAGE_KEY: 'pioneer_grower_data',
    SESSION_KEY: 'pioneer_session',
    PRODUCTS: [
        'Corn Seed', 'Soybean Seed', 'Sorghum', 'Alfalfa',
        'Herbicide', 'Fungicide', 'Insecticide', 'Fertilizer',
        'Equipment', 'Other'
    ],
    YEARS: [2022, 2023, 2024, 2025, 2026],
    CHART_COLORS: [
        '#1a5f2a', '#2d8a42', '#3498db', '#f5a623', '#e74c3c',
        '#9b59b6', '#1abc9c', '#34495e', '#f39c12', '#95a5a6'
    ]
};

// ============================================
// STATE MANAGEMENT
// ============================================
let state = {
    data: [],
    charts: {},
    isAuthenticated: false
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    checkAuthentication();
    initializeEventListeners();
    setCurrentDate();
});

function checkAuthentication() {
    const session = sessionStorage.getItem(CONFIG.SESSION_KEY);
    if (session === 'authenticated') {
        state.isAuthenticated = true;
        showDashboard();
    }
}

function setCurrentDate() {
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

// ============================================
// AUTHENTICATION
// ============================================
function initializeEventListeners() {
    // Login form
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Historical filters
    document.getElementById('apply-hist-filter')?.addEventListener('click', updateHistoricalCharts);

    // Forecasting
    document.getElementById('run-forecast')?.addEventListener('click', runForecast);

    // Grower filters
    document.getElementById('apply-grower-filter')?.addEventListener('click', updateGrowerAnalysis);

    // Product filters
    document.getElementById('apply-product-filter')?.addEventListener('click', updateProductAnalysis);

    // Data management
    initializeDataManagement();
}

function handleLogin(e) {
    e.preventDefault();
    const code = document.getElementById('access-code').value;
    const errorEl = document.getElementById('login-error');

    if (code === CONFIG.ACCESS_CODE) {
        state.isAuthenticated = true;
        sessionStorage.setItem(CONFIG.SESSION_KEY, 'authenticated');
        showDashboard();
    } else {
        errorEl.textContent = 'Invalid access code. Please try again.';
        document.getElementById('access-code').value = '';
    }
}

function handleLogout() {
    state.isAuthenticated = false;
    sessionStorage.removeItem(CONFIG.SESSION_KEY);
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('access-code').value = '';
    document.getElementById('login-error').textContent = '';
    destroyAllCharts();
}

function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    loadData();
    initializeAllCharts();
    updateDataSummary();
}

// ============================================
// TAB NAVIGATION
// ============================================
function switchTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabId}-tab`);
    });

    // Refresh charts for the active tab
    setTimeout(() => {
        Object.values(state.charts).forEach(chart => {
            if (chart) chart.resize();
        });
    }, 100);
}

// ============================================
// DATA MANAGEMENT
// ============================================
function loadData() {
    const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
    state.data = stored ? JSON.parse(stored) : [];
}

function saveData() {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.data));
    updateDataSummary();
}

function addDataEntry(entry) {
    state.data.push({
        ...entry,
        id: generateId(),
        created_at: new Date().toISOString()
    });
    saveData();
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function initializeDataManagement() {
    // CSV Upload
    const csvUploadArea = document.getElementById('csv-upload-area');
    const csvFileInput = document.getElementById('csv-file');
    const browseBtn = document.getElementById('browse-csv');

    browseBtn?.addEventListener('click', () => csvFileInput.click());

    csvFileInput?.addEventListener('change', (e) => handleCSVUpload(e.target.files[0]));

    csvUploadArea?.addEventListener('dragover', (e) => {
        e.preventDefault();
        csvUploadArea.classList.add('dragover');
    });

    csvUploadArea?.addEventListener('dragleave', () => {
        csvUploadArea.classList.remove('dragover');
    });

    csvUploadArea?.addEventListener('drop', (e) => {
        e.preventDefault();
        csvUploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) {
            handleCSVUpload(file);
        } else {
            showToast('Please upload a CSV file', 'error');
        }
    });

    // CSV Import/Cancel buttons
    document.getElementById('import-csv')?.addEventListener('click', importCSVData);
    document.getElementById('cancel-csv')?.addEventListener('click', cancelCSVImport);

    // Manual entry form
    document.getElementById('manual-entry-form')?.addEventListener('submit', handleManualEntry);

    // Bulk paste
    document.getElementById('parse-bulk')?.addEventListener('click', parseBulkData);
    document.getElementById('import-bulk')?.addEventListener('click', importBulkData);

    // Export/Clear
    document.getElementById('export-csv')?.addEventListener('click', exportToCSV);
    document.getElementById('clear-data')?.addEventListener('click', clearAllData);
}

// CSV Handling
let pendingCSVData = [];

function handleCSVUpload(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        pendingCSVData = parseCSV(text);

        if (pendingCSVData.length > 0) {
            showCSVPreview(pendingCSVData);
        } else {
            showToast('No valid data found in CSV', 'error');
        }
    };
    reader.readAsText(file);
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    const data = [];

    // Check if first line is header
    const firstLine = lines[0].toLowerCase();
    const startIndex = firstLine.includes('date') || firstLine.includes('invoice') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Handle both comma and tab separated values
        const values = line.includes('\t') ? line.split('\t') : parseCSVLine(line);

        if (values.length >= 6) {
            const entry = {
                date: values[0].trim(),
                invoice_number: values[1].trim(),
                grower_name: values[2].trim(),
                product: values[3].trim(),
                quantity: parseFloat(values[4]) || 0,
                amount: parseFloat(values[5].replace(/[$,]/g, '')) || 0
            };

            if (entry.date && entry.grower_name && entry.product) {
                data.push(entry);
            }
        }
    }

    return data;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let char of line) {
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);

    return result;
}

function showCSVPreview(data) {
    const previewContainer = document.getElementById('csv-preview');
    const table = document.getElementById('csv-preview-table');

    let html = `
        <thead>
            <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th>Grower</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Amount</th>
            </tr>
        </thead>
        <tbody>
    `;

    const previewData = data.slice(0, 5);
    previewData.forEach(row => {
        html += `
            <tr>
                <td>${row.date}</td>
                <td>${row.invoice_number}</td>
                <td>${row.grower_name}</td>
                <td>${row.product}</td>
                <td>${row.quantity}</td>
                <td>$${row.amount.toLocaleString()}</td>
            </tr>
        `;
    });

    if (data.length > 5) {
        html += `<tr><td colspan="6" style="text-align: center; color: #7f8c8d;">... and ${data.length - 5} more rows</td></tr>`;
    }

    html += '</tbody>';
    table.innerHTML = html;
    previewContainer.classList.remove('hidden');
}

function importCSVData() {
    if (pendingCSVData.length === 0) return;

    pendingCSVData.forEach(entry => addDataEntry(entry));

    showToast(`Successfully imported ${pendingCSVData.length} records`, 'success');
    pendingCSVData = [];
    document.getElementById('csv-preview').classList.add('hidden');
    document.getElementById('csv-file').value = '';

    refreshAllCharts();
}

function cancelCSVImport() {
    pendingCSVData = [];
    document.getElementById('csv-preview').classList.add('hidden');
    document.getElementById('csv-file').value = '';
}

// Manual Entry
function handleManualEntry(e) {
    e.preventDefault();

    const entry = {
        date: document.getElementById('entry-date').value,
        invoice_number: document.getElementById('entry-invoice').value,
        grower_name: document.getElementById('entry-grower').value,
        product: document.getElementById('entry-product').value,
        quantity: parseFloat(document.getElementById('entry-quantity').value) || 0,
        amount: parseFloat(document.getElementById('entry-amount').value) || 0
    };

    addDataEntry(entry);
    showToast('Entry added successfully', 'success');
    e.target.reset();
    refreshAllCharts();
}

// Bulk Paste
let pendingBulkData = [];

function parseBulkData() {
    const text = document.getElementById('bulk-paste').value.trim();
    if (!text) {
        showToast('Please paste some data first', 'warning');
        return;
    }

    pendingBulkData = parseCSV(text);

    if (pendingBulkData.length > 0) {
        showBulkPreview(pendingBulkData);
        document.getElementById('import-bulk').disabled = false;
    } else {
        showToast('No valid data found. Check format: date, invoice, grower, product, quantity, amount', 'error');
    }
}

function showBulkPreview(data) {
    const previewContainer = document.getElementById('bulk-preview');
    const table = document.getElementById('bulk-preview-table');

    let html = `
        <thead>
            <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th>Grower</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Amount</th>
            </tr>
        </thead>
        <tbody>
    `;

    data.forEach(row => {
        html += `
            <tr>
                <td>${row.date}</td>
                <td>${row.invoice_number}</td>
                <td>${row.grower_name}</td>
                <td>${row.product}</td>
                <td>${row.quantity}</td>
                <td>$${row.amount.toLocaleString()}</td>
            </tr>
        `;
    });

    html += '</tbody>';
    table.innerHTML = html;
    previewContainer.classList.remove('hidden');
}

function importBulkData() {
    if (pendingBulkData.length === 0) return;

    pendingBulkData.forEach(entry => addDataEntry(entry));

    showToast(`Successfully imported ${pendingBulkData.length} records`, 'success');
    pendingBulkData = [];
    document.getElementById('bulk-preview').classList.add('hidden');
    document.getElementById('bulk-paste').value = '';
    document.getElementById('import-bulk').disabled = true;

    refreshAllCharts();
}

// Export
function exportToCSV() {
    const year = document.getElementById('export-year').value;
    let dataToExport = state.data;

    if (year !== 'all') {
        dataToExport = state.data.filter(d => new Date(d.date).getFullYear() === parseInt(year));
    }

    if (dataToExport.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }

    const headers = ['date', 'invoice_number', 'grower_name', 'product', 'quantity', 'amount'];
    const rows = dataToExport.map(d => headers.map(h => d[h]));

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pioneer_grower_data_${year === 'all' ? 'all' : year}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast(`Exported ${dataToExport.length} records`, 'success');
}

function clearAllData() {
    if (confirm('Are you sure you want to delete all data? This cannot be undone.')) {
        state.data = [];
        saveData();
        showToast('All data cleared', 'info');
        refreshAllCharts();
    }
}

function updateDataSummary() {
    document.getElementById('total-records').textContent = state.data.length.toLocaleString();

    if (state.data.length > 0) {
        const dates = state.data.map(d => new Date(d.date)).filter(d => !isNaN(d));
        if (dates.length > 0) {
            const minDate = new Date(Math.min(...dates));
            const maxDate = new Date(Math.max(...dates));
            document.getElementById('data-date-range').textContent =
                `${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}`;
        }

        const uniqueGrowers = new Set(state.data.map(d => d.grower_name));
        document.getElementById('unique-growers').textContent = uniqueGrowers.size.toLocaleString();
    } else {
        document.getElementById('data-date-range').textContent = 'No data';
        document.getElementById('unique-growers').textContent = '0';
    }

    document.getElementById('last-updated').textContent = new Date().toLocaleString();
}

// ============================================
// CHART MANAGEMENT
// ============================================
function destroyAllCharts() {
    Object.keys(state.charts).forEach(key => {
        if (state.charts[key]) {
            state.charts[key].destroy();
            state.charts[key] = null;
        }
    });
}

function initializeAllCharts() {
    updateOverviewStats();
    createOverviewCharts();
    updateHistoricalCharts();
    runForecast();
    updateGrowerAnalysis();
    updateProductAnalysis();
}

function refreshAllCharts() {
    initializeAllCharts();
    updateDataSummary();
}

// ============================================
// OVERVIEW TAB
// ============================================
function updateOverviewStats() {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;

    const currentYearData = filterDataByYear(currentYear);
    const lastYearData = filterDataByYear(lastYear);

    const totalRevenue = currentYearData.reduce((sum, d) => sum + d.amount, 0);
    const lastYearRevenue = lastYearData.reduce((sum, d) => sum + d.amount, 0);
    const revenueChange = lastYearRevenue ? ((totalRevenue - lastYearRevenue) / lastYearRevenue * 100) : 0;

    const growers = new Set(currentYearData.map(d => d.grower_name)).size;
    const lastYearGrowers = new Set(lastYearData.map(d => d.grower_name)).size;
    const growersChange = growers - lastYearGrowers;

    const orders = currentYearData.length;
    const lastYearOrders = lastYearData.length;
    const ordersChange = lastYearOrders ? ((orders - lastYearOrders) / lastYearOrders * 100) : 0;

    const currentGrowers = new Set(currentYearData.map(d => d.grower_name));
    const previousGrowers = new Set(lastYearData.map(d => d.grower_name));
    const returningGrowers = [...currentGrowers].filter(g => previousGrowers.has(g)).length;
    const retentionRate = previousGrowers.size ? (returningGrowers / previousGrowers.size * 100) : 0;

    document.getElementById('total-revenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('revenue-change').textContent = `${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}%`;
    document.getElementById('revenue-change').className = `stat-change ${revenueChange >= 0 ? 'positive' : 'negative'}`;

    document.getElementById('total-growers').textContent = growers.toLocaleString();
    document.getElementById('growers-change').textContent = `${growersChange >= 0 ? '+' : ''}${growersChange}`;
    document.getElementById('growers-change').className = `stat-change ${growersChange >= 0 ? 'positive' : 'negative'}`;

    document.getElementById('total-orders').textContent = orders.toLocaleString();
    document.getElementById('orders-change').textContent = `${ordersChange >= 0 ? '+' : ''}${ordersChange.toFixed(1)}%`;
    document.getElementById('orders-change').className = `stat-change ${ordersChange >= 0 ? 'positive' : 'negative'}`;

    document.getElementById('retention-rate').textContent = `${retentionRate.toFixed(1)}%`;
}

function createOverviewCharts() {
    createOverviewRevenueChart();
    createOverviewProductChart();
    createOverviewMonthlyChart();
}

function createOverviewRevenueChart() {
    const ctx = document.getElementById('overview-revenue-chart')?.getContext('2d');
    if (!ctx) return;

    if (state.charts.overviewRevenue) state.charts.overviewRevenue.destroy();

    const yearlyData = CONFIG.YEARS.map(year => {
        const data = filterDataByYear(year);
        return data.reduce((sum, d) => sum + d.amount, 0);
    });

    state.charts.overviewRevenue = new Chart(ctx, {
        type: 'line',
        data: {
            labels: CONFIG.YEARS,
            datasets: [{
                label: 'Revenue',
                data: yearlyData,
                borderColor: CONFIG.CHART_COLORS[0],
                backgroundColor: `${CONFIG.CHART_COLORS[0]}20`,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });
}

function createOverviewProductChart() {
    const ctx = document.getElementById('overview-product-chart')?.getContext('2d');
    if (!ctx) return;

    if (state.charts.overviewProduct) state.charts.overviewProduct.destroy();

    const productData = {};
    CONFIG.PRODUCTS.forEach(p => productData[p] = 0);

    state.data.forEach(d => {
        if (productData.hasOwnProperty(d.product)) {
            productData[d.product] += d.amount;
        }
    });

    const labels = Object.keys(productData).filter(k => productData[k] > 0);
    const data = labels.map(l => productData[l]);

    state.charts.overviewProduct = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: CONFIG.CHART_COLORS.slice(0, labels.length)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { boxWidth: 12 }
                }
            }
        }
    });
}

function createOverviewMonthlyChart() {
    const ctx = document.getElementById('overview-monthly-chart')?.getContext('2d');
    if (!ctx) return;

    if (state.charts.overviewMonthly) state.charts.overviewMonthly.destroy();

    const currentYear = new Date().getFullYear();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const monthlyData = months.map((_, index) => {
        return state.data
            .filter(d => {
                const date = new Date(d.date);
                return date.getFullYear() === currentYear && date.getMonth() === index;
            })
            .reduce((sum, d) => sum + d.amount, 0);
    });

    state.charts.overviewMonthly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Revenue',
                data: monthlyData,
                backgroundColor: CONFIG.CHART_COLORS[0]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });
}

// ============================================
// HISTORICAL ANALYSIS TAB
// ============================================
function updateHistoricalCharts() {
    const startYear = parseInt(document.getElementById('hist-year-start')?.value || 2022);
    const endYear = parseInt(document.getElementById('hist-year-end')?.value || 2026);
    const product = document.getElementById('hist-product')?.value || 'all';

    const years = [];
    for (let y = startYear; y <= endYear; y++) {
        years.push(y);
    }

    createHistoricalRevenueChart(years, product);
    createYoYComparisonChart(years, product);
    createGrowthRateChart(years, product);
    updateHistoricalTable(years, product);
}

function createHistoricalRevenueChart(years, product) {
    const ctx = document.getElementById('historical-revenue-chart')?.getContext('2d');
    if (!ctx) return;

    if (state.charts.historicalRevenue) state.charts.historicalRevenue.destroy();

    const yearlyData = years.map(year => {
        let data = filterDataByYear(year);
        if (product !== 'all') {
            data = data.filter(d => d.product === product);
        }
        return data.reduce((sum, d) => sum + d.amount, 0);
    });

    state.charts.historicalRevenue = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [{
                label: 'Revenue',
                data: yearlyData,
                backgroundColor: CONFIG.CHART_COLORS[0],
                borderColor: CONFIG.CHART_COLORS[0],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });
}

function createYoYComparisonChart(years, product) {
    const ctx = document.getElementById('yoy-comparison-chart')?.getContext('2d');
    if (!ctx) return;

    if (state.charts.yoyComparison) state.charts.yoyComparison.destroy();

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const datasets = years.slice(-3).map((year, index) => {
        const monthlyData = months.map((_, monthIndex) => {
            let data = state.data.filter(d => {
                const date = new Date(d.date);
                return date.getFullYear() === year && date.getMonth() === monthIndex;
            });
            if (product !== 'all') {
                data = data.filter(d => d.product === product);
            }
            return data.reduce((sum, d) => sum + d.amount, 0);
        });

        return {
            label: year.toString(),
            data: monthlyData,
            borderColor: CONFIG.CHART_COLORS[index],
            backgroundColor: 'transparent',
            tension: 0.4
        };
    });

    state.charts.yoyComparison = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });
}

function createGrowthRateChart(years, product) {
    const ctx = document.getElementById('growth-rate-chart')?.getContext('2d');
    if (!ctx) return;

    if (state.charts.growthRate) state.charts.growthRate.destroy();

    const yearlyData = years.map(year => {
        let data = filterDataByYear(year);
        if (product !== 'all') {
            data = data.filter(d => d.product === product);
        }
        return data.reduce((sum, d) => sum + d.amount, 0);
    });

    const growthRates = yearlyData.map((value, index) => {
        if (index === 0) return 0;
        const prevValue = yearlyData[index - 1];
        return prevValue ? ((value - prevValue) / prevValue * 100) : 0;
    });

    state.charts.growthRate = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [{
                label: 'Growth Rate (%)',
                data: growthRates,
                backgroundColor: growthRates.map(r => r >= 0 ? CONFIG.CHART_COLORS[1] : CONFIG.CHART_COLORS[4])
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    ticks: {
                        callback: value => `${value.toFixed(1)}%`
                    }
                }
            }
        }
    });
}

function updateHistoricalTable(years, product) {
    const tbody = document.querySelector('#historical-summary-table tbody');
    if (!tbody) return;

    let html = '';
    let prevRevenue = 0;

    years.forEach(year => {
        let data = filterDataByYear(year);
        if (product !== 'all') {
            data = data.filter(d => d.product === product);
        }

        const revenue = data.reduce((sum, d) => sum + d.amount, 0);
        const orders = data.length;
        const growers = new Set(data.map(d => d.grower_name)).size;
        const avgOrderValue = orders ? revenue / orders : 0;
        const growth = prevRevenue ? ((revenue - prevRevenue) / prevRevenue * 100) : 0;

        html += `
            <tr>
                <td>${year}</td>
                <td>${formatCurrency(revenue)}</td>
                <td>${orders.toLocaleString()}</td>
                <td>${growers.toLocaleString()}</td>
                <td>${formatCurrency(avgOrderValue)}</td>
                <td class="${growth >= 0 ? 'status-active' : 'status-inactive'}">${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%</td>
            </tr>
        `;

        prevRevenue = revenue;
    });

    tbody.innerHTML = html || '<tr><td colspan="6" style="text-align: center;">No data available</td></tr>';
}

// ============================================
// FORECASTING TAB
// ============================================
function runForecast() {
    const method = document.getElementById('forecast-method')?.value || 'linear';
    const confidence = parseFloat(document.getElementById('confidence-level')?.value || 0.9);

    const yearlyData = CONFIG.YEARS.map(year => {
        const data = filterDataByYear(year);
        return {
            year,
            revenue: data.reduce((sum, d) => sum + d.amount, 0),
            growers: new Set(data.map(d => d.grower_name)).size
        };
    });

    const forecast = calculateForecast(yearlyData, method, confidence);

    updateForecastSummary(forecast, yearlyData);
    createForecastChart(yearlyData, forecast, confidence);
    createProductForecastChart();
    createMonthlyForecastChart();
}

function calculateForecast(data, method, confidence) {
    const revenues = data.map(d => d.revenue);
    const growers = data.map(d => d.growers);
    const years = data.map(d => d.year);

    let forecastRevenue, forecastGrowers;

    switch (method) {
        case 'linear':
            forecastRevenue = linearRegression(years, revenues, 2027);
            forecastGrowers = linearRegression(years, growers, 2027);
            break;
        case 'growth':
            forecastRevenue = growthRateForecast(revenues);
            forecastGrowers = growthRateForecast(growers);
            break;
        case 'weighted':
            forecastRevenue = weightedAverageForecast(revenues);
            forecastGrowers = weightedAverageForecast(growers);
            break;
        default:
            forecastRevenue = linearRegression(years, revenues, 2027);
            forecastGrowers = linearRegression(years, growers, 2027);
    }

    // Calculate confidence intervals
    const revenueStdDev = standardDeviation(revenues);
    const zScore = getZScore(confidence);
    const marginOfError = revenueStdDev * zScore;

    const growerStdDev = standardDeviation(growers);
    const growerMargin = growerStdDev * zScore;

    return {
        revenue: Math.max(0, forecastRevenue),
        revenueLow: Math.max(0, forecastRevenue - marginOfError),
        revenueHigh: forecastRevenue + marginOfError,
        growers: Math.max(0, Math.round(forecastGrowers)),
        growersLow: Math.max(0, Math.round(forecastGrowers - growerMargin)),
        growersHigh: Math.round(forecastGrowers + growerMargin)
    };
}

function linearRegression(x, y, targetX) {
    const n = x.length;
    if (n === 0) return 0;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return slope * targetX + intercept;
}

function growthRateForecast(data) {
    if (data.length < 2) return data[data.length - 1] || 0;

    const growthRates = [];
    for (let i = 1; i < data.length; i++) {
        if (data[i - 1] > 0) {
            growthRates.push((data[i] - data[i - 1]) / data[i - 1]);
        }
    }

    const avgGrowth = growthRates.length ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length : 0;
    return data[data.length - 1] * (1 + avgGrowth);
}

function weightedAverageForecast(data) {
    if (data.length === 0) return 0;

    const weights = data.map((_, i) => i + 1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    const weighted = data.reduce((sum, value, i) => sum + value * weights[i], 0);
    const weightedAvg = weighted / totalWeight;

    // Apply trend
    const lastValue = data[data.length - 1];
    const avgValue = data.reduce((a, b) => a + b, 0) / data.length;
    const trend = lastValue > avgValue ? 1.05 : 0.95;

    return weightedAvg * trend;
}

function standardDeviation(data) {
    if (data.length === 0) return 0;
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const squaredDiffs = data.map(value => Math.pow(value - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / data.length);
}

function getZScore(confidence) {
    const zScores = {
        0.80: 1.28,
        0.90: 1.645,
        0.95: 1.96
    };
    return zScores[confidence] || 1.645;
}

function updateForecastSummary(forecast, yearlyData) {
    const lastYearRevenue = yearlyData[yearlyData.length - 1]?.revenue || 0;
    const growth = lastYearRevenue ? ((forecast.revenue - lastYearRevenue) / lastYearRevenue * 100) : 0;

    document.getElementById('forecast-revenue').textContent = formatCurrency(forecast.revenue);
    document.getElementById('forecast-range').textContent =
        `Range: ${formatCurrency(forecast.revenueLow)} - ${formatCurrency(forecast.revenueHigh)}`;

    document.getElementById('forecast-growers').textContent = forecast.growers.toLocaleString();
    document.getElementById('forecast-growers-range').textContent =
        `Range: ${forecast.growersLow} - ${forecast.growersHigh}`;

    document.getElementById('forecast-growth').textContent = `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`;
    document.getElementById('forecast-growth-range').textContent = 'vs 2026';
}

function createForecastChart(yearlyData, forecast, confidence) {
    const ctx = document.getElementById('forecast-chart')?.getContext('2d');
    if (!ctx) return;

    if (state.charts.forecast) state.charts.forecast.destroy();

    const years = [...CONFIG.YEARS, 2027];
    const revenues = [...yearlyData.map(d => d.revenue), null];
    const forecastLine = [...Array(CONFIG.YEARS.length).fill(null), forecast.revenue];
    const upperBound = [...Array(CONFIG.YEARS.length).fill(null), forecast.revenueHigh];
    const lowerBound = [...Array(CONFIG.YEARS.length).fill(null), forecast.revenueLow];

    state.charts.forecast = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Historical Revenue',
                    data: revenues,
                    borderColor: CONFIG.CHART_COLORS[0],
                    backgroundColor: `${CONFIG.CHART_COLORS[0]}20`,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: '2027 Forecast',
                    data: forecastLine,
                    borderColor: CONFIG.CHART_COLORS[3],
                    backgroundColor: CONFIG.CHART_COLORS[3],
                    borderDash: [5, 5],
                    pointRadius: 8,
                    pointStyle: 'star'
                },
                {
                    label: 'Upper Bound',
                    data: upperBound,
                    borderColor: `${CONFIG.CHART_COLORS[3]}80`,
                    backgroundColor: 'transparent',
                    borderDash: [2, 2],
                    pointRadius: 5
                },
                {
                    label: 'Lower Bound',
                    data: lowerBound,
                    borderColor: `${CONFIG.CHART_COLORS[3]}80`,
                    backgroundColor: 'transparent',
                    borderDash: [2, 2],
                    pointRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                annotation: {
                    annotations: {
                        confidenceBand: {
                            type: 'box',
                            xMin: 4.5,
                            xMax: 5.5,
                            yMin: forecast.revenueLow,
                            yMax: forecast.revenueHigh,
                            backgroundColor: `${CONFIG.CHART_COLORS[3]}20`,
                            borderColor: 'transparent'
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });
}

function createProductForecastChart() {
    const ctx = document.getElementById('product-forecast-chart')?.getContext('2d');
    if (!ctx) return;

    if (state.charts.productForecast) state.charts.productForecast.destroy();

    const productForecasts = CONFIG.PRODUCTS.map(product => {
        const yearlyRevenues = CONFIG.YEARS.map(year => {
            const data = filterDataByYear(year).filter(d => d.product === product);
            return data.reduce((sum, d) => sum + d.amount, 0);
        });

        return {
            product,
            forecast: linearRegression(CONFIG.YEARS, yearlyRevenues, 2027)
        };
    }).filter(p => p.forecast > 0).sort((a, b) => b.forecast - a.forecast);

    state.charts.productForecast = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: productForecasts.map(p => p.product),
            datasets: [{
                label: '2027 Projected Revenue',
                data: productForecasts.map(p => p.forecast),
                backgroundColor: CONFIG.CHART_COLORS
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });
}

function createMonthlyForecastChart() {
    const ctx = document.getElementById('monthly-forecast-chart')?.getContext('2d');
    if (!ctx) return;

    if (state.charts.monthlyForecast) state.charts.monthlyForecast.destroy();

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Calculate average monthly distribution
    const monthlyDistribution = months.map((_, index) => {
        let totalMonthRevenue = 0;
        let totalYearRevenue = 0;

        CONFIG.YEARS.forEach(year => {
            const yearData = filterDataByYear(year);
            const monthData = yearData.filter(d => new Date(d.date).getMonth() === index);
            totalMonthRevenue += monthData.reduce((sum, d) => sum + d.amount, 0);
            totalYearRevenue += yearData.reduce((sum, d) => sum + d.amount, 0);
        });

        return totalYearRevenue ? totalMonthRevenue / totalYearRevenue : 1 / 12;
    });

    // Get 2027 forecast
    const yearlyRevenues = CONFIG.YEARS.map(year => {
        const data = filterDataByYear(year);
        return data.reduce((sum, d) => sum + d.amount, 0);
    });
    const forecast2027 = linearRegression(CONFIG.YEARS, yearlyRevenues, 2027);

    const monthlyForecast = monthlyDistribution.map(dist => forecast2027 * dist);

    state.charts.monthlyForecast = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Projected Monthly Revenue',
                data: monthlyForecast,
                backgroundColor: CONFIG.CHART_COLORS[1]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });
}

// ============================================
// GROWER ANALYSIS TAB
// ============================================
function updateGrowerAnalysis() {
    const year = parseInt(document.getElementById('grower-year')?.value || new Date().getFullYear());
    const sortBy = document.getElementById('grower-sort')?.value || 'revenue';
    const searchTerm = document.getElementById('grower-search')?.value.toLowerCase() || '';

    updateGrowerStats(year);
    createRetentionTrendChart();
    createTopGrowersChart(year);
    updateGrowerTable(year, sortBy, searchTerm);
}

function updateGrowerStats(year) {
    const currentYearData = filterDataByYear(year);
    const previousYearData = filterDataByYear(year - 1);

    const currentGrowers = new Set(currentYearData.map(d => d.grower_name));
    const previousGrowers = new Set(previousYearData.map(d => d.grower_name));

    const newGrowers = [...currentGrowers].filter(g => !previousGrowers.has(g)).length;
    const returningGrowers = [...currentGrowers].filter(g => previousGrowers.has(g)).length;
    const lostGrowers = [...previousGrowers].filter(g => !currentGrowers.has(g)).length;
    const retentionRate = previousGrowers.size ? (returningGrowers / previousGrowers.size * 100) : 0;

    document.getElementById('new-growers').textContent = newGrowers.toLocaleString();
    document.getElementById('returning-growers').textContent = returningGrowers.toLocaleString();
    document.getElementById('lost-growers').textContent = lostGrowers.toLocaleString();
    document.getElementById('grower-retention').textContent = `${retentionRate.toFixed(1)}%`;
}

function createRetentionTrendChart() {
    const ctx = document.getElementById('retention-trend-chart')?.getContext('2d');
    if (!ctx) return;

    if (state.charts.retentionTrend) state.charts.retentionTrend.destroy();

    const retentionData = CONFIG.YEARS.map((year, index) => {
        if (index === 0) return 0;

        const currentGrowers = new Set(filterDataByYear(year).map(d => d.grower_name));
        const previousGrowers = new Set(filterDataByYear(year - 1).map(d => d.grower_name));

        const returning = [...currentGrowers].filter(g => previousGrowers.has(g)).length;
        return previousGrowers.size ? (returning / previousGrowers.size * 100) : 0;
    });

    state.charts.retentionTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: CONFIG.YEARS,
            datasets: [{
                label: 'Retention Rate',
                data: retentionData,
                borderColor: CONFIG.CHART_COLORS[0],
                backgroundColor: `${CONFIG.CHART_COLORS[0]}20`,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: value => `${value}%`
                    }
                }
            }
        }
    });
}

function createTopGrowersChart(year) {
    const ctx = document.getElementById('top-growers-chart')?.getContext('2d');
    if (!ctx) return;

    if (state.charts.topGrowers) state.charts.topGrowers.destroy();

    const yearData = filterDataByYear(year);
    const growerRevenue = {};

    yearData.forEach(d => {
        growerRevenue[d.grower_name] = (growerRevenue[d.grower_name] || 0) + d.amount;
    });

    const topGrowers = Object.entries(growerRevenue)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    state.charts.topGrowers = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topGrowers.map(g => g[0]),
            datasets: [{
                label: 'Revenue',
                data: topGrowers.map(g => g[1]),
                backgroundColor: CONFIG.CHART_COLORS[0]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });
}

function updateGrowerTable(year, sortBy, searchTerm) {
    const tbody = document.querySelector('#grower-table tbody');
    if (!tbody) return;

    const yearData = filterDataByYear(year);
    const previousYearGrowers = new Set(filterDataByYear(year - 1).map(d => d.grower_name));

    const growerStats = {};

    yearData.forEach(d => {
        if (!growerStats[d.grower_name]) {
            growerStats[d.grower_name] = {
                name: d.grower_name,
                revenue: 0,
                orders: 0,
                products: new Set(),
                firstPurchase: d.date,
                lastPurchase: d.date
            };
        }

        const stats = growerStats[d.grower_name];
        stats.revenue += d.amount;
        stats.orders++;
        stats.products.add(d.product);

        if (new Date(d.date) < new Date(stats.firstPurchase)) stats.firstPurchase = d.date;
        if (new Date(d.date) > new Date(stats.lastPurchase)) stats.lastPurchase = d.date;
    });

    let growers = Object.values(growerStats);

    // Filter by search term
    if (searchTerm) {
        growers = growers.filter(g => g.name.toLowerCase().includes(searchTerm));
    }

    // Sort
    switch (sortBy) {
        case 'revenue':
            growers.sort((a, b) => b.revenue - a.revenue);
            break;
        case 'orders':
            growers.sort((a, b) => b.orders - a.orders);
            break;
        case 'name':
            growers.sort((a, b) => a.name.localeCompare(b.name));
            break;
    }

    let html = '';
    growers.forEach(g => {
        const isReturning = previousYearGrowers.has(g.name);
        const status = isReturning ? 'Returning' : 'New';
        const statusClass = isReturning ? 'status-active' : '';

        html += `
            <tr>
                <td>${g.name}</td>
                <td>${formatCurrency(g.revenue)}</td>
                <td>${g.orders}</td>
                <td>${g.products.size}</td>
                <td>${formatDate(g.firstPurchase)}</td>
                <td>${formatDate(g.lastPurchase)}</td>
                <td class="${statusClass}">${status}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html || '<tr><td colspan="7" style="text-align: center;">No grower data available</td></tr>';
}

// ============================================
// PRODUCT ANALYSIS TAB
// ============================================
function updateProductAnalysis() {
    const year = document.getElementById('product-year')?.value || 'all';

    createProductRevenueChart(year);
    createProductUnitsChart(year);
    createProductTrendChart();
    updateProductTable(year);
}

function createProductRevenueChart(year) {
    const ctx = document.getElementById('product-revenue-chart')?.getContext('2d');
    if (!ctx) return;

    if (state.charts.productRevenue) state.charts.productRevenue.destroy();

    let data = year === 'all' ? state.data : filterDataByYear(parseInt(year));

    const productRevenue = {};
    CONFIG.PRODUCTS.forEach(p => productRevenue[p] = 0);

    data.forEach(d => {
        if (productRevenue.hasOwnProperty(d.product)) {
            productRevenue[d.product] += d.amount;
        }
    });

    const labels = Object.keys(productRevenue).filter(k => productRevenue[k] > 0);
    const values = labels.map(l => productRevenue[l]);

    state.charts.productRevenue = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: CONFIG.CHART_COLORS.slice(0, labels.length)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { boxWidth: 12 }
                }
            }
        }
    });
}

function createProductUnitsChart(year) {
    const ctx = document.getElementById('product-units-chart')?.getContext('2d');
    if (!ctx) return;

    if (state.charts.productUnits) state.charts.productUnits.destroy();

    let data = year === 'all' ? state.data : filterDataByYear(parseInt(year));

    const productUnits = {};
    CONFIG.PRODUCTS.forEach(p => productUnits[p] = 0);

    data.forEach(d => {
        if (productUnits.hasOwnProperty(d.product)) {
            productUnits[d.product] += d.quantity;
        }
    });

    const sortedProducts = Object.entries(productUnits)
        .filter(([_, v]) => v > 0)
        .sort((a, b) => b[1] - a[1]);

    state.charts.productUnits = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedProducts.map(p => p[0]),
            datasets: [{
                label: 'Units Sold',
                data: sortedProducts.map(p => p[1]),
                backgroundColor: CONFIG.CHART_COLORS[1]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function createProductTrendChart() {
    const ctx = document.getElementById('product-trend-chart')?.getContext('2d');
    if (!ctx) return;

    if (state.charts.productTrend) state.charts.productTrend.destroy();

    // Get top 5 products by total revenue
    const totalRevenue = {};
    state.data.forEach(d => {
        totalRevenue[d.product] = (totalRevenue[d.product] || 0) + d.amount;
    });

    const topProducts = Object.entries(totalRevenue)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(p => p[0]);

    const datasets = topProducts.map((product, index) => {
        const yearlyData = CONFIG.YEARS.map(year => {
            const data = filterDataByYear(year).filter(d => d.product === product);
            return data.reduce((sum, d) => sum + d.amount, 0);
        });

        return {
            label: product,
            data: yearlyData,
            borderColor: CONFIG.CHART_COLORS[index],
            backgroundColor: 'transparent',
            tension: 0.4
        };
    });

    state.charts.productTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: CONFIG.YEARS,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });
}

function updateProductTable(year) {
    const tbody = document.querySelector('#product-table tbody');
    if (!tbody) return;

    let data = year === 'all' ? state.data : filterDataByYear(parseInt(year));
    const previousYearData = year === 'all' ? [] : filterDataByYear(parseInt(year) - 1);

    const productStats = {};
    const previousProductRevenue = {};

    CONFIG.PRODUCTS.forEach(p => {
        productStats[p] = { revenue: 0, units: 0 };
        previousProductRevenue[p] = 0;
    });

    data.forEach(d => {
        if (productStats.hasOwnProperty(d.product)) {
            productStats[d.product].revenue += d.amount;
            productStats[d.product].units += d.quantity;
        }
    });

    previousYearData.forEach(d => {
        if (previousProductRevenue.hasOwnProperty(d.product)) {
            previousProductRevenue[d.product] += d.amount;
        }
    });

    const totalRevenue = Object.values(productStats).reduce((sum, p) => sum + p.revenue, 0);

    const products = Object.entries(productStats)
        .filter(([_, stats]) => stats.revenue > 0)
        .sort((a, b) => b[1].revenue - a[1].revenue);

    let html = '';
    products.forEach(([product, stats]) => {
        const avgPrice = stats.units ? stats.revenue / stats.units : 0;
        const percentOfTotal = totalRevenue ? (stats.revenue / totalRevenue * 100) : 0;
        const prevRevenue = previousProductRevenue[product];
        const yoyChange = prevRevenue ? ((stats.revenue - prevRevenue) / prevRevenue * 100) : 0;

        html += `
            <tr>
                <td>${product}</td>
                <td>${formatCurrency(stats.revenue)}</td>
                <td>${stats.units.toLocaleString()}</td>
                <td>${formatCurrency(avgPrice)}</td>
                <td>${percentOfTotal.toFixed(1)}%</td>
                <td class="${yoyChange >= 0 ? 'status-active' : 'status-inactive'}">${yoyChange >= 0 ? '+' : ''}${yoyChange.toFixed(1)}%</td>
            </tr>
        `;
    });

    tbody.innerHTML = html || '<tr><td colspan="6" style="text-align: center;">No product data available</td></tr>';
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function filterDataByYear(year) {
    return state.data.filter(d => {
        const date = new Date(d.date);
        return date.getFullYear() === year;
    });
}

function formatCurrency(value) {
    if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
        return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// SAMPLE DATA FOR DEMO (Remove in production)
// ============================================
function generateSampleData() {
    const growers = [
        'Johnson Farms', 'Miller Agriculture', 'Smith Family Farm',
        'Anderson Growers', 'Wilson Ag Co', 'Taylor Fields',
        'Brown Ranch', 'Davis Farming', 'Thompson Acres', 'White Harvest'
    ];

    const sampleData = [];

    CONFIG.YEARS.forEach(year => {
        const numEntries = 50 + Math.floor(Math.random() * 100);

        for (let i = 0; i < numEntries; i++) {
            const month = Math.floor(Math.random() * 12) + 1;
            const day = Math.floor(Math.random() * 28) + 1;
            const grower = growers[Math.floor(Math.random() * growers.length)];
            const product = CONFIG.PRODUCTS[Math.floor(Math.random() * CONFIG.PRODUCTS.length)];
            const quantity = Math.floor(Math.random() * 500) + 10;
            const basePrice = product.includes('Seed') ? 300 : product === 'Equipment' ? 5000 : 100;
            const amount = quantity * (basePrice + Math.random() * basePrice * 0.5);

            sampleData.push({
                date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
                invoice_number: `INV-${year}-${(i + 1).toString().padStart(4, '0')}`,
                grower_name: grower,
                product: product,
                quantity: quantity,
                amount: Math.round(amount * 100) / 100
            });
        }
    });

    return sampleData;
}

// Uncomment to load sample data on first run
// if (state.data.length === 0) {
//     state.data = generateSampleData();
//     saveData();
// }
