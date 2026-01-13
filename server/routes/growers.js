/**
 * Grower Routes
 * API endpoints for grower-related operations
 */

const express = require('express');
const router = express.Router();

// Get Grower model (may not be available if MongoDB not connected)
const getModel = () => {
    try {
        return require('../models/GrowerTransaction');
    } catch (error) {
        return null;
    }
};

/**
 * GET /api/growers
 * Get all unique growers with their summary statistics
 */
router.get('/', async (req, res) => {
    try {
        const GrowerTransaction = getModel();

        if (!GrowerTransaction) {
            return res.status(503).json({
                error: 'Database not available',
                message: 'MongoDB connection required for this endpoint'
            });
        }

        const year = req.query.year ? parseInt(req.query.year) : null;
        const growers = await GrowerTransaction.getGrowerSummary(year);

        res.json({
            success: true,
            count: growers.length,
            year: year || 'all',
            growers
        });
    } catch (error) {
        console.error('Error fetching growers:', error);
        res.status(500).json({ error: 'Failed to fetch growers' });
    }
});

/**
 * GET /api/growers/:name
 * Get detailed information for a specific grower
 */
router.get('/:name', async (req, res) => {
    try {
        const GrowerTransaction = getModel();

        if (!GrowerTransaction) {
            return res.status(503).json({
                error: 'Database not available',
                message: 'MongoDB connection required for this endpoint'
            });
        }

        const growerName = decodeURIComponent(req.params.name);
        const transactions = await GrowerTransaction.find({ grower_name: growerName })
            .sort({ date: -1 });

        if (transactions.length === 0) {
            return res.status(404).json({
                error: 'Grower not found',
                message: `No records found for grower: ${growerName}`
            });
        }

        // Calculate summary
        const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
        const totalQuantity = transactions.reduce((sum, t) => sum + t.quantity, 0);
        const products = [...new Set(transactions.map(t => t.product))];
        const years = [...new Set(transactions.map(t => new Date(t.date).getFullYear()))];

        res.json({
            success: true,
            grower: {
                name: growerName,
                totalRevenue,
                totalQuantity,
                totalOrders: transactions.length,
                products,
                yearsActive: years.sort(),
                firstPurchase: transactions[transactions.length - 1].date,
                lastPurchase: transactions[0].date,
                transactions
            }
        });
    } catch (error) {
        console.error('Error fetching grower:', error);
        res.status(500).json({ error: 'Failed to fetch grower details' });
    }
});

/**
 * GET /api/growers/:name/transactions
 * Get all transactions for a specific grower
 */
router.get('/:name/transactions', async (req, res) => {
    try {
        const GrowerTransaction = getModel();

        if (!GrowerTransaction) {
            return res.status(503).json({
                error: 'Database not available',
                message: 'MongoDB connection required for this endpoint'
            });
        }

        const growerName = decodeURIComponent(req.params.name);
        const { year, product, limit = 100, page = 1 } = req.query;

        const query = { grower_name: growerName };

        if (year) {
            query.date = {
                $gte: new Date(`${year}-01-01`),
                $lte: new Date(`${year}-12-31`)
            };
        }

        if (product) {
            query.product = product;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const transactions = await GrowerTransaction.find(query)
            .sort({ date: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await GrowerTransaction.countDocuments(query);

        res.json({
            success: true,
            grower: growerName,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            },
            transactions
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

/**
 * GET /api/growers/retention/analysis
 * Get retention analysis data
 */
router.get('/retention/analysis', async (req, res) => {
    try {
        const GrowerTransaction = getModel();

        if (!GrowerTransaction) {
            return res.status(503).json({
                error: 'Database not available',
                message: 'MongoDB connection required for this endpoint'
            });
        }

        const years = [2022, 2023, 2024, 2025, 2026];
        const retentionData = [];

        for (let i = 1; i < years.length; i++) {
            const currentYear = years[i];
            const previousYear = years[i - 1];

            // Get growers for each year
            const currentGrowers = await GrowerTransaction.distinct('grower_name', {
                date: {
                    $gte: new Date(`${currentYear}-01-01`),
                    $lte: new Date(`${currentYear}-12-31`)
                }
            });

            const previousGrowers = await GrowerTransaction.distinct('grower_name', {
                date: {
                    $gte: new Date(`${previousYear}-01-01`),
                    $lte: new Date(`${previousYear}-12-31`)
                }
            });

            const previousSet = new Set(previousGrowers);
            const currentSet = new Set(currentGrowers);

            const returning = currentGrowers.filter(g => previousSet.has(g));
            const newGrowers = currentGrowers.filter(g => !previousSet.has(g));
            const lost = previousGrowers.filter(g => !currentSet.has(g));

            retentionData.push({
                year: currentYear,
                totalGrowers: currentGrowers.length,
                returningGrowers: returning.length,
                newGrowers: newGrowers.length,
                lostGrowers: lost.length,
                retentionRate: previousGrowers.length > 0
                    ? (returning.length / previousGrowers.length * 100).toFixed(1)
                    : 0
            });
        }

        res.json({
            success: true,
            retention: retentionData
        });
    } catch (error) {
        console.error('Error calculating retention:', error);
        res.status(500).json({ error: 'Failed to calculate retention' });
    }
});

/**
 * GET /api/growers/top/:count
 * Get top growers by revenue
 */
router.get('/top/:count', async (req, res) => {
    try {
        const GrowerTransaction = getModel();

        if (!GrowerTransaction) {
            return res.status(503).json({
                error: 'Database not available',
                message: 'MongoDB connection required for this endpoint'
            });
        }

        const count = parseInt(req.params.count) || 10;
        const year = req.query.year ? parseInt(req.query.year) : null;

        const growers = await GrowerTransaction.getGrowerSummary(year);
        const topGrowers = growers.slice(0, count);

        res.json({
            success: true,
            year: year || 'all',
            count: topGrowers.length,
            growers: topGrowers
        });
    } catch (error) {
        console.error('Error fetching top growers:', error);
        res.status(500).json({ error: 'Failed to fetch top growers' });
    }
});

module.exports = router;
