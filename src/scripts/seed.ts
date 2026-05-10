import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables the same way the server does
dotenv.config();

import Mill from '../models/Mill';
import User from '../models/User';

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected');

    // Step 1 — Create the mill first, because User requires a millId reference.
    // We use findOneAndUpdate with upsert:true so running this script
    // multiple times is safe — it won't create duplicate mills.
    const mill = await Mill.findOneAndUpdate(
      { code: 'SAPM' },
      {
        name:     'Sri Aman Palm Oil Mill Sdn Bhd',
        code:     'SAPM',
        location: 'Sri Aman, Sarawak',
        isActive: true,
      },
      { upsert: true, new: true }
    );
    console.log(`✅ Mill ready: ${mill.name} (${mill._id})`);

    // Step 2 — Create the admin user.
    // We hash the password here manually since we removed the pre-hook.
    const existing = await User.findOne({ email: 'admin@sawitgrad.com' });
    if (existing) {
      console.log('ℹ️  Admin user already exists, skipping.');
    } else {
      const hashedPassword = await bcrypt.hash('Admin@2026!', 12);
      const admin = await User.create({
        name:     'Administrator',
        email:    'admin@sawitgrad.com',
        password: hashedPassword,
        role:     'admin',
        millId:   mill._id,
        isActive: true,
      });
      console.log(`✅ Admin user created: ${admin.email}`);
    }

    // Step 3 — Create a test grader account so you can test the app login
    const existingGrader = await User.findOne({ email: 'grader@sawitgrad.com' });
    if (existingGrader) {
      console.log('ℹ️  Grader user already exists, skipping.');
    } else {
      const hashedPassword = await bcrypt.hash('Grader@2026!', 12);
      const grader = await User.create({
        name:     'Test Grader',
        email:    'grader@sawitgrad.com',
        password: hashedPassword,
        role:     'grader',
        millId:   mill._id,
        isActive: true,
      });
      console.log(`✅ Grader user created: ${grader.email}`);
    }

    console.log('\n🎉 Seed complete. Credentials:');
    console.log('   Admin  → admin@sawitgrad.com  / Admin@2026!');
    console.log('   Grader → grader@sawitgrad.com / Grader@2026!');
    console.log('\n⚠️  Change these passwords after first login!\n');

  } catch (err) {
    console.error('❌ Seed error:', err);
  } finally {
    // Always disconnect cleanly — otherwise the script hangs indefinitely
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

seed();