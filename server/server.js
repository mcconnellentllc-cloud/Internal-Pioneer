/**
 * Pioneer Analytics - Backend Server
 * Node.js Express server with optional MongoDB support
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

// Import routes
const growerRoutes = require('./routes/growers');

// Import database connection (optional)
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from parent directory
app.use(express.static(path.join(__dirname, '..')));

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'), false);
        }
    }
});

// In-memory data store (fallback when MongoDB is not available)
let inMemoryData = [];

// Authentication middleware
const authenticate = (req, res, next) => {
    const accessCode = req.headers['x-access-code'];
    if (accessCode === process.env.ACCESS_CODE || accessCode === 'pioneer2024') {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized: Invalid access code' });
    }
};

// API Routes
app.use('/api/growers', authenticate, growerRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        mongodb: process.env.MONGODB_URI ? 'configured' : 'not configured'
    });
});

// Authentication endpoint
app.post('/api/auth', (req, res) => {
    const { accessCode } = req.body;
    if (accessCode === process.env.ACCESS_CODE || accessCode === 'pioneer2024') {
        res.json({ success: true, message: 'Authentication successful' });
    } else {
        res.status(401).json({ success: false, error: 'Invalid access code' });
    }
});

// CSV Upload endpoint
app.post('/api/upload', authenticate, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const csvData = req.file.buffer.toString('utf-8');
        const records = parseCSV(csvData);

        if (records.length === 0) {
            return res.status(400).json({ error: 'No valid records found in CSV' });
        }

        // Save to database or in-memory store
        if (process.env.MONGODB_URI) {
            const GrowerTransaction = require('./models/GrowerTransaction');
            await GrowerTransaction.insertMany(records);
        } else {
            inMemoryData.push(...records);
        }

        res.json({
            success: true,
            message: `Successfully imported ${records.length} records`,
            count: records.length
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to process upload' });
    }
});

// Get all data endpoint
app.get('/api/data', authenticate, async (req, res) => {
    try {
        let data;
        if (process.env.MONGODB_URI) {
            const GrowerTransaction = require('./models/GrowerTransaction');
            data = await GrowerTransaction.find().sort({ date: -1 });
        } else {
            data = inMemoryData;
        }

        res.json({
            success: true,
            count: data.length,
            data: data
        });
    } catch (error) {
        console.error('Data fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

// Add single record endpoint
app.post('/api/data', authenticate, async (req, res) => {
    try {
        const { date, invoice_number, grower_name, product, quantity, amount } = req.body;

        if (!date || !grower_name || !product) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const record = {
            date,
            invoice_number,
            grower_name,
            product,
            quantity: parseFloat(quantity) || 0,
            amount: parseFloat(amount) || 0,
            created_at: new Date()
        };

        if (process.env.MONGODB_URI) {
            const GrowerTransaction = require('./models/GrowerTransaction');
            const saved = await GrowerTransaction.create(record);
            res.json({ success: true, data: saved });
        } else {
            record.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
            inMemoryData.push(record);
            res.json({ success: true, data: record });
        }
    } catch (error) {
        console.error('Add record error:', error);
        res.status(500).json({ error: 'Failed to add record' });
    }
});

// Delete all data endpoint
app.delete('/api/data', authenticate, async (req, res) => {
    try {
        if (process.env.MONGODB_URI) {
            const GrowerTransaction = require('./models/GrowerTransaction');
            await GrowerTransaction.deleteMany({});
        } else {
            inMemoryData = [];
        }

        res.json({ success: true, message: 'All data deleted' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Failed to delete data' });
    }
});

// Analytics endpoints
app.get('/api/analytics/summary', authenticate, async (req, res) => {
    try {
        let data;
        if (process.env.MONGODB_URI) {
            const GrowerTransaction = require('./models/GrowerTransaction');
            data = await GrowerTransaction.find();
        } else {
            data = inMemoryData;
        }

        const summary = calculateSummary(data);
        res.json({ success: true, summary });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to calculate analytics' });
    }
});

app.get('/api/analytics/by-year/:year', authenticate, async (req, res) => {
    try {
        const year = parseInt(req.params.year);
        let data;

        if (process.env.MONGODB_URI) {
            const GrowerTransaction = require('./models/GrowerTransaction');
            const startDate = new Date(`${year}-01-01`);
            const endDate = new Date(`${year}-12-31`);
            data = await GrowerTransaction.find({
                date: { $gte: startDate, $lte: endDate }
            });
        } else {
            data = inMemoryData.filter(d => new Date(d.date).getFullYear() === year);
        }

        const summary = calculateSummary(data);
        res.json({ success: true, year, summary });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to calculate analytics' });
    }
});

app.get('/api/analytics/by-product', authenticate, async (req, res) => {
    try {
        let data;
        if (process.env.MONGODB_URI) {
            const GrowerTransaction = require('./models/GrowerTransaction');
            data = await GrowerTransaction.find();
        } else {
            data = inMemoryData;
        }

        const byProduct = {};
        data.forEach(d => {
            if (!byProduct[d.product]) {
                byProduct[d.product] = { revenue: 0, quantity: 0, orders: 0 };
            }
            byProduct[d.product].revenue += d.amount;
            byProduct[d.product].quantity += d.quantity;
            byProduct[d.product].orders++;
        });

        res.json({ success: true, products: byProduct });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to calculate analytics' });
    }
});

app.get('/api/analytics/by-grower', authenticate, async (req, res) => {
    try {
        let data;
        if (process.env.MONGODB_URI) {
            const GrowerTransaction = require('./models/GrowerTransaction');
            data = await GrowerTransaction.find();
        } else {
            data = inMemoryData;
        }

        const byGrower = {};
        data.forEach(d => {
            if (!byGrower[d.grower_name]) {
                byGrower[d.grower_name] = {
                    revenue: 0,
                    orders: 0,
                    products: new Set(),
                    firstPurchase: d.date,
                    lastPurchase: d.date
                };
            }
            const grower = byGrower[d.grower_name];
            grower.revenue += d.amount;
            grower.orders++;
            grower.products.add(d.product);
            if (new Date(d.date) < new Date(grower.firstPurchase)) grower.firstPurchase = d.date;
            if (new Date(d.date) > new Date(grower.lastPurchase)) grower.lastPurchase = d.date;
        });

        // Convert Sets to arrays for JSON serialization
        Object.values(byGrower).forEach(g => {
            g.products = Array.from(g.products);
        });

        res.json({ success: true, growers: byGrower });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to calculate analytics' });
    }
});

// CSV Export endpoint
app.get('/api/export', authenticate, async (req, res) => {
    try {
        const year = req.query.year;
        let data;

        if (process.env.MONGODB_URI) {
            const GrowerTransaction = require('./models/GrowerTransaction');
            if (year && year !== 'all') {
                const startDate = new Date(`${year}-01-01`);
                const endDate = new Date(`${year}-12-31`);
                data = await GrowerTransaction.find({
                    date: { $gte: startDate, $lte: endDate }
                });
            } else {
                data = await GrowerTransaction.find();
            }
        } else {
            if (year && year !== 'all') {
                data = inMemoryData.filter(d => new Date(d.date).getFullYear() === parseInt(year));
            } else {
                data = inMemoryData;
            }
        }

        const csv = generateCSV(data);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=pioneer_data_${year || 'all'}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// Helper Functions
function parseCSV(text) {
    const lines = text.trim().split('\n');
    const records = [];

    // Check for header row
    const firstLine = lines[0].toLowerCase();
    const startIndex = firstLine.includes('date') || firstLine.includes('invoice') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.includes('\t') ? line.split('\t') : parseCSVLine(line);

        if (values.length >= 6) {
            records.push({
                date: values[0].trim(),
                invoice_number: values[1].trim(),
                grower_name: values[2].trim(),
                product: values[3].trim(),
                quantity: parseFloat(values[4]) || 0,
                amount: parseFloat(values[5].replace(/[$,]/g, '')) || 0,
                created_at: new Date()
            });
        }
    }

    return records;
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

function calculateSummary(data) {
    const totalRevenue = data.reduce((sum, d) => sum + (d.amount || 0), 0);
    const totalOrders = data.length;
    const uniqueGrowers = new Set(data.map(d => d.grower_name)).size;
    const totalUnits = data.reduce((sum, d) => sum + (d.quantity || 0), 0);

    return {
        totalRevenue,
        totalOrders,
        uniqueGrowers,
        totalUnits,
        avgOrderValue: totalOrders ? totalRevenue / totalOrders : 0
    };
}

function generateCSV(data) {
    const headers = ['date', 'invoice_number', 'grower_name', 'product', 'quantity', 'amount'];
    const rows = data.map(d => headers.map(h => d[h] || '').join(','));
    return [headers.join(','), ...rows].join('\n');
}

// Connect to MongoDB if configured, then start server
async function startServer() {
    if (process.env.MONGODB_URI) {
        try {
            await connectDB();
            console.log('MongoDB connected successfully');
        } catch (error) {
            console.warn('MongoDB connection failed, using in-memory storage:', error.message);
        }
    } else {
        console.log('No MongoDB URI configured, using in-memory storage');
    }

    app.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════════════════╗
║     Pioneer Analytics Server                      ║
║     Running on http://localhost:${PORT}              ║
║                                                   ║
║     API Endpoints:                                ║
║     - GET  /api/health     - Health check         ║
║     - POST /api/auth       - Authenticate         ║
║     - GET  /api/data       - Get all data         ║
║     - POST /api/data       - Add record           ║
║     - POST /api/upload     - Upload CSV           ║
║     - GET  /api/export     - Export CSV           ║
║     - GET  /api/analytics/*  - Analytics          ║
╚══════════════════════════════════════════════════╝
        `);
    });
}

startServer();

module.exports = app;
