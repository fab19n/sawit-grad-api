import mongoose, { Schema, Document } from 'mongoose';

export type ConflictResolution = 'keep_original' | 'use_new' | 'assign_new_serial';

export interface IConflict extends Document {
  originalRecordId: mongoose.Types.ObjectId;
  serialNo:         string;
  millId:           mongoose.Types.ObjectId;
  conflictingData:  Record<string, any>;  // full snapshot of what Device B sent
  submittedBy:      mongoose.Types.ObjectId;
  resolution:       ConflictResolution | null;
  resolvedAt:       Date | null;
  resolvedBy:       mongoose.Types.ObjectId | null;
  newSerialNo:      string | null;        // only set when resolution = assign_new_serial
}

const ConflictSchema = new Schema<IConflict>({
  originalRecordId: { type: Schema.Types.ObjectId, ref: 'Record', required: true },
  serialNo:         { type: String, required: true },
  millId:           { type: Schema.Types.ObjectId, ref: 'Mill', required: true },
  conflictingData:  { type: Schema.Types.Mixed, required: true },
  submittedBy:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  resolution:       {
    type: String,
    enum: ['keep_original', 'use_new', 'assign_new_serial', null],
    default: null,
  },
  resolvedAt:  { type: Date, default: null },
  resolvedBy:  { type: Schema.Types.ObjectId, ref: 'User', default: null },
  newSerialNo: { type: String, default: null },
}, { timestamps: true });

export default mongoose.model<IConflict>('Conflict', ConflictSchema);