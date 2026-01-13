/**
 * Grower Transaction Model
 * Mongoose schema for storing grower transaction data
 */

const mongoose = require('mongoose');

const GrowerTransactionSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        index: true
    },
    invoice_number: {
        type: String,
        trim: true,
        index: true
    },
    grower_name: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    product: {
        type: String,
        required: true,
        trim: true,
        enum: [
            'Corn Seed',
            'Soybean Seed',
            'Sorghum',
            'Alfalfa',
            'Herbicide',
            'Fungicide',
            'Insecticide',
            'Fertilizer',
            'Equipment',
            'Other'
        ],
        index: true
    },
    quantity: {
        type: Number,
        default: 0,
        min: 0
    },
    amount: {
        type: Number,
        default: 0,
        min: 0
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'grower_transactions'
});

// Indexes for common queries
GrowerTransactionSchema.index({ date: 1, grower_name: 1 });
GrowerTransactionSchema.index({ date: 1, product: 1 });
GrowerTransactionSchema.index({ grower_name: 1, product: 1 });

// Virtual for year extraction
GrowerTransactionSchema.virtual('year').get(function() {
    return this.date ? new Date(this.date).getFullYear() : null;
});

// Virtual for month extraction
GrowerTransactionSchema.virtual('month').get(function() {
    return this.date ? new Date(this.date).getMonth() + 1 : null;
});

// Static method to get summary by year
GrowerTransactionSchema.statics.getSummaryByYear = async function(year) {
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31`);

    const result = await this.aggregate([
        {
            $match: {
                date: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$amount' },
                totalQuantity: { $sum: '$quantity' },
                totalOrders: { $sum: 1 },
                uniqueGrowers: { $addToSet: '$grower_name' }
            }
        },
        {
            $project: {
                _id: 0,
                totalRevenue: 1,
                totalQuantity: 1,
                totalOrders: 1,
                uniqueGrowers: { $size: '$uniqueGrowers' }
            }
        }
    ]);

    return result[0] || { totalRevenue: 0, totalQuantity: 0, totalOrders: 0, uniqueGrowers: 0 };
};

// Static method to get product breakdown
GrowerTransactionSchema.statics.getProductBreakdown = async function(year = null) {
    const match = year ? {
        date: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`)
        }
    } : {};

    return this.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$product',
                totalRevenue: { $sum: '$amount' },
                totalQuantity: { $sum: '$quantity' },
                orderCount: { $sum: 1 }
            }
        },
        {
            $project: {
                product: '$_id',
                _id: 0,
                totalRevenue: 1,
                totalQuantity: 1,
                orderCount: 1,
                avgOrderValue: { $divide: ['$totalRevenue', '$orderCount'] }
            }
        },
        { $sort: { totalRevenue: -1 } }
    ]);
};

// Static method to get grower summary
GrowerTransactionSchema.statics.getGrowerSummary = async function(year = null) {
    const match = year ? {
        date: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`)
        }
    } : {};

    return this.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$grower_name',
                totalRevenue: { $sum: '$amount' },
                orderCount: { $sum: 1 },
                products: { $addToSet: '$product' },
                firstPurchase: { $min: '$date' },
                lastPurchase: { $max: '$date' }
            }
        },
        {
            $project: {
                grower_name: '$_id',
                _id: 0,
                totalRevenue: 1,
                orderCount: 1,
                productCount: { $size: '$products' },
                products: 1,
                firstPurchase: 1,
                lastPurchase: 1
            }
        },
        { $sort: { totalRevenue: -1 } }
    ]);
};

// Static method to get monthly trends
GrowerTransactionSchema.statics.getMonthlyTrends = async function(year) {
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31`);

    return this.aggregate([
        {
            $match: {
                date: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: { $month: '$date' },
                totalRevenue: { $sum: '$amount' },
                totalQuantity: { $sum: '$quantity' },
                orderCount: { $sum: 1 }
            }
        },
        {
            $project: {
                month: '$_id',
                _id: 0,
                totalRevenue: 1,
                totalQuantity: 1,
                orderCount: 1
            }
        },
        { $sort: { month: 1 } }
    ]);
};

// Ensure virtuals are included in JSON output
GrowerTransactionSchema.set('toJSON', { virtuals: true });
GrowerTransactionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('GrowerTransaction', GrowerTransactionSchema);
