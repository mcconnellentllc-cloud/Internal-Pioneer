# Pioneer Analytics - Grower Dashboard

A comprehensive data analytics dashboard for tracking grower sales, product performance, and forecasting future trends.

## Features

- **5-Year Historical Analysis (2022-2026)**: Visualize revenue trends, growth rates, and year-over-year comparisons
- **2027 Forecasting**: Predictive analytics with configurable confidence intervals using linear regression, growth rate, and weighted average methods
- **Grower Analysis & Retention Tracking**: Monitor customer retention, identify new vs. returning growers, and track top performers
- **Product Mix Analysis**: Revenue breakdown by product category with trend visualization
- **Flexible Data Import**: CSV upload, manual entry, and bulk paste functionality
- **Data Export**: Export filtered data to CSV format
- **Password Protection**: Secure access with access code authentication
- **Offline Capable**: LocalStorage persistence for offline use

## Quick Start

### Option 1: Static Files (No Server)

Simply open `index.html` in a web browser. All data is stored in the browser's localStorage.

```bash
# Open directly in browser
open index.html
# or
xdg-open index.html  # Linux
```

### Option 2: Node.js Server (Recommended)

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Start the server
npm start

# Access dashboard at http://localhost:3000
```

### Option 3: With MongoDB

```bash
# Copy environment template
cp server/.env.example server/.env

# Edit .env and add your MongoDB URI
# MONGODB_URI=mongodb://localhost:27017/pioneer_analytics

# Start the server
cd server && npm start
```

## Access

**Default Access Code**: `pioneer2024`

## Data Format

The dashboard accepts data in the following format:

| Field | Type | Description |
|-------|------|-------------|
| date | Date | Transaction date (YYYY-MM-DD) |
| invoice_number | String | Unique invoice identifier |
| grower_name | String | Customer/grower name |
| product | String | Product category |
| quantity | Number | Units purchased |
| amount | Number | Total transaction amount ($) |

### Supported Products

- Corn Seed
- Soybean Seed
- Sorghum
- Alfalfa
- Herbicide
- Fungicide
- Insecticide
- Fertilizer
- Equipment
- Other

### Example CSV Format

```csv
date,invoice_number,grower_name,product,quantity,amount
2024-03-15,INV-2024-001,Johnson Farms,Corn Seed,150,22500
2024-03-16,INV-2024-002,Miller Agriculture,Soybean Seed,100,15000
2024-03-17,INV-2024-003,Smith Family Farm,Herbicide,50,4500
```

## Dashboard Tabs

### Overview
- Total revenue, active growers, orders, and retention rate
- Revenue trend chart (2022-2026)
- Product distribution pie chart
- Monthly performance bar chart

### Historical Analysis
- 5-year revenue analysis with customizable date range
- Year-over-year comparison
- Growth rate visualization
- Historical summary table

### 2027 Forecasting
- Multiple forecasting methods:
  - **Linear Trend**: Uses linear regression on historical data
  - **Growth Rate**: Projects based on average historical growth
  - **Weighted Average**: Emphasizes recent years more heavily
- Configurable confidence intervals (80%, 90%, 95%)
- Product category and monthly distribution forecasts

### Grower Analysis
- New, returning, and lost grower tracking
- Retention rate trends
- Top 10 growers by revenue
- Searchable grower details table

### Product Mix
- Revenue by product category
- Units sold by product
- Product performance trends over time
- Year-over-year change analysis

### Data Management
- **CSV Import**: Drag-and-drop or file browser upload
- **Manual Entry**: Form-based single record entry
- **Bulk Paste**: Paste tab or comma-separated data
- **Export**: Download data as CSV
- **Clear Data**: Reset all stored data

## API Endpoints (Server Mode)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health check |
| POST | `/api/auth` | Authenticate with access code |
| GET | `/api/data` | Retrieve all transaction data |
| POST | `/api/data` | Add a single record |
| POST | `/api/upload` | Upload CSV file |
| DELETE | `/api/data` | Clear all data |
| GET | `/api/export` | Export data as CSV |
| GET | `/api/analytics/summary` | Get overall summary |
| GET | `/api/analytics/by-year/:year` | Get year-specific summary |
| GET | `/api/analytics/by-product` | Get product breakdown |
| GET | `/api/analytics/by-grower` | Get grower breakdown |
| GET | `/api/growers` | List all growers |
| GET | `/api/growers/:name` | Get specific grower details |
| GET | `/api/growers/top/:count` | Get top growers |
| GET | `/api/growers/retention/analysis` | Get retention analysis |

All API endpoints (except `/api/health` and `/api/auth`) require the `X-Access-Code` header.

## Project Structure

```
Internal-Pioneer/
├── index.html              # Main dashboard HTML
├── styles.css              # Dashboard styling
├── app.js                  # Frontend JavaScript
├── README.md               # This file
└── server/
    ├── package.json        # Node.js dependencies
    ├── server.js           # Express server
    ├── .env.example        # Environment template
    ├── config/
    │   └── db.js           # MongoDB connection
    ├── models/
    │   └── GrowerTransaction.js  # Data model
    └── routes/
        └── growers.js      # Grower API routes
```

## Importing Your Data

Once the dashboard is running, navigate to the **Data Management** tab to import your 2024 and 2025 grower data:

1. **CSV Upload**: Prepare your data as a CSV file with the columns: date, invoice_number, grower_name, product, quantity, amount. Drag and drop the file or click to browse.

2. **Bulk Paste**: Copy your data from Excel or another source and paste it directly. The system accepts both comma-separated and tab-separated values.

3. **Manual Entry**: Use the form to add individual records.

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Charts**: Chart.js with annotation plugin
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (optional) with Mongoose ODM
- **Storage**: LocalStorage for offline/static use

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## License

MIT License - Pioneer Analytics
