import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables before anything else
dotenv.config();

import authRoutes    from './routes/auth';
import recordRoutes  from './routes/records';

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security middleware ──────────────────────────────────────────────────────

// helmet adds ~15 security-related HTTP headers automatically
app.use(helmet());

// CORS — only allow requests from your app and your future dashboard
// In development, we allow all origins for convenience
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? allowedOrigins : '*',
  credentials: true,
}));

// Rate limiting — max 100 requests per 15 minutes per IP
// This prevents brute force attacks on the login endpoint
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Terlalu banyak permintaan. Cuba lagi sebentar.' },
});
app.use('/api/', limiter);

// ── Body parsing ─────────────────────────────────────────────────────────────

// Increase the limit to 50mb to accommodate Base64 photo uploads
// A typical phone photo at 0.6 quality is about 200-400kb as Base64,
// so 3 photos per record = ~1.2mb max, well within this limit
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth',    authRoutes);
app.use('/api/records', recordRoutes);

// Health check endpoint — Render uses this to verify the service is alive
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler for any route that doesn't match
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Laluan tidak dijumpai.' });
});

// ── Database connection ───────────────────────────────────────────────────────

async function connectDB(): Promise<void> {
  try {
    const uri = process.env.MONGODB_URI!;
    await mongoose.connect(uri, {
      // These two options tell Mongoose to use the newer
      // URL parser and server discovery engine, which are
      // more reliable and handle Atlas cluster topology changes
      // (like automatic failover) more gracefully
      serverSelectionTimeoutMS: 5000,  // Give up trying to connect after 5 seconds
      socketTimeoutMS: 45000,          // Close sockets after 45 seconds of inactivity
      maxPoolSize: 10,                 // Maintain up to 10 socket connections
      // For a mobile app with bursts of activity (graders uploading
      // at shift change), a pool size of 10 is more than sufficient
    });
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}

// ── Start server ──────────────────────────────────────────────────────────────

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 SawitGrad API running on port ${PORT}`);
    console.log(`📋 Environment: ${process.env.NODE_ENV}`);
  });
});