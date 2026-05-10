import mongoose, { Schema, Document } from 'mongoose';

// A Mill represents one client — Sri Aman Palm Oil Mill is one Mill document.
// When you add a second client mill in the future, they get their own Mill document.
// Every User and every GradingRecord references a millId, which is how
// multi-tenancy works — data is siloed by mill at the database query level.
export interface IMill extends Document {
  name:      string;
  code:      string;   // Short code e.g. "SAPM" for Sri Aman Palm Oil Mill
  location:  string;
  isActive:  boolean;
  createdAt: Date;
}

const MillSchema = new Schema<IMill>({
  name:      { type: String, required: true, trim: true },
  code:      { type: String, required: true, unique: true, uppercase: true, trim: true },
  location:  { type: String, default: '' },
  isActive:  { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model<IMill>('Mill', MillSchema);