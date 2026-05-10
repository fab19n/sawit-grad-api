import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name:          string;
  email:         string;
  password:      string;
  role:          'grader' | 'manager' | 'admin';
  millId:        mongoose.Types.ObjectId;
  isActive:      boolean;
  lastLoginAt:   Date | null;
}

const UserSchema = new Schema<IUser>(
  {
    name:        { type: String, required: true, trim: true },
    email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select: false means this field is excluded from query results by default.
    // You have to explicitly ask for it with .select('+password') when you
    // need it — like during login. This prevents accidentally leaking
    // password hashes in API responses.
    password:    { type: String, required: true, minlength: 8, select: false },
    role:        { type: String, enum: ['grader', 'manager', 'admin'], default: 'grader' },
    millId:      { type: Schema.Types.ObjectId, ref: 'Mill', required: true },
    isActive:    { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);