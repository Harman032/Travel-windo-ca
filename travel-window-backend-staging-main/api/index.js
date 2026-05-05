// Vercel serverless function - Express is first-class on Vercel
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// CORS middleware - Allow ALL origins by reflecting the request origin
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Allow non-browser requests
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection - Optimized for serverless (Official Pattern)
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const uri = process.env.MONGODB_URI || process.env.travel_window_MONGODB_URI;
    
    if (!uri) {
      console.error('=> ERROR: MONGODB_URI is not defined');
      throw new Error('Missing MONGODB_URI environment variable');
    }

    const opts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      heartbeatFrequencyMS: 1000,
      connectTimeoutMS: 10000,
    };

    console.log('=> Starting new MongoDB connection...');
    cached.promise = mongoose.connect(uri, opts).then((mongoose) => {
      console.log('=> MongoDB connected');
      return mongoose;
    }).catch((error) => {
      console.error('=> MongoDB connection error:', error.message);
      cached.promise = null;
      throw error;
    });
  }

  // Set a timeout for the connection promise itself to avoid Vercel 504
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Database connection timed out (8s)')), 8000)
  );

  try {
    cached.conn = await Promise.race([cached.promise, timeoutPromise]);
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
};

// API info payload - all endpoints
const apiEndpoints = {
  test: 'GET /api/test',
  health: 'GET /api/health',
  auth: {
    login: 'POST /api/auth/login',
    register: 'POST /api/auth/register',
    me: 'GET /api/auth/me'
  },
  users: 'GET/POST/PUT/DELETE /api/users',
  bookings: 'GET/POST/PUT/DELETE /api/bookings',
  suppliers: 'GET/POST/PUT/DELETE /api/suppliers',
  reports: 'GET /api/reports',
  dashboard: 'GET /api/dashboard',
  payments: 'GET/POST /api/payments',
  seed: 'GET/POST /api/seed?secret=SEED_SECRET'
};

// Root route (for /api and /)
app.get('/', (req, res) => {
  res.json({ 
    message: 'Travel Window Backend API',
    status: 'running',
    endpoints: apiEndpoints,
    timestamp: new Date().toISOString()
  });
});
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Travel Window Backend API',
    status: 'running',
    endpoints: apiEndpoints,
    timestamp: new Date().toISOString()
  });
});

// Test route (without DB) - handle both /test and /api/test
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Backend working', 
    path: req.path,
    originalUrl: req.originalUrl,
    timestamp: new Date().toISOString() 
  });
});
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend working', 
    path: req.path,
    originalUrl: req.originalUrl,
    timestamp: new Date().toISOString() 
  });
});

// Diagnostic route for DB
app.get('/api/test-db', async (req, res) => {
  const uri = process.env.MONGODB_URI || process.env.travel_window_MONGODB_URI;
  const status = {
    env_uri_exists: !!uri,
    env_uri_prefix: uri ? uri.substring(0, 15) + '...' : 'none',
    readyState: mongoose.connection.readyState,
    timestamp: new Date().toISOString()
  };

  try {
    console.log('=> Manual test-db connection start...');
    if (uri) {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      status.success = true;
      status.connected_to = mongoose.connection.name;
    } else {
      status.success = false;
      status.error = 'No URI found in environment';
    }
  } catch (err) {
    status.success = false;
    status.error = err.message;
  }

  res.json(status);
});

// Health check (without DB dependency) - handle both /health and /api/health
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    connected: !!cached.conn,
    readyState: mongoose.connection.readyState,
    path: req.path,
    originalUrl: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    connected: !!cached.conn,
    readyState: mongoose.connection.readyState,
    path: req.path,
    originalUrl: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Middleware to ensure DB connection before routes
const ensureDB = async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('DB connection error:', error);
    return res.status(503).json({ 
      error: 'Database connection failed', 
      message: error.message,
      hint: 'Check MongoDB Atlas network access and connection string',
      readyState: mongoose.connection.readyState
    });
  }
};

// Routes - mount under /api so frontend requests to /api/auth/login etc. match
app.use('/api/auth', ensureDB, require('../routes/auth'));
app.use('/api/users', ensureDB, require('../routes/users'));
app.use('/api/bookings', ensureDB, require('../routes/bookings'));
app.use('/api/suppliers', ensureDB, require('../routes/suppliers'));
app.use('/api/reports', ensureDB, require('../routes/reports'));
app.use('/api/dashboard', ensureDB, require('../routes/dashboard'));
app.use('/api/payments', ensureDB, require('../routes/payments'));
app.use('/api/seed', ensureDB, require('../routes/seed'));

// Catch-all route for debugging
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    originalUrl: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Export app - Vercel handles Express natively
module.exports = app;
