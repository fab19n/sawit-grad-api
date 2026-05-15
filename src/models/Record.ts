import mongoose, { Schema, Document } from 'mongoose';

// The sub-schema for a single grading row (Bil. Tandan, %, Penalti)
const GradingRowSchema = new Schema({
  bil:     { type: Number, default: 0 },
  pct:     { type: Number, default: 0 },
  penalti: { type: Number, default: 0 },
}, { _id: false }); // _id: false because these are embedded sub-documents, not top-level

export interface IRecord extends Document {
  // The serial number from the app — this is the human-readable ID graders see
  serialNo:       string;
  millId:         mongoose.Types.ObjectId;
  submittedBy:    mongoose.Types.ObjectId;
  date:           string;
  time:           string;
  namaLesen:      string;
  noLesenMPOB:    string;
  noKenderaan:    string;
  noTiketTimbang: number;
  bilanganSampel: number;
  beratBersih:    number;
  purataBerat:    number;
  boer:           number;
  bker:           number;
  tandanMasak:    { bil: number; pct: number; penalti: number };
  tandanMengkal:  { bil: number; pct: number; penalti: number };
  tandanBusuk:    { bil: number; pct: number; penalti: number };
  tandanKosong:   { bil: number; pct: number; penalti: number };
  jumlahB:        { bil: number; pct: number; penalti: number };
  tandanKotor:    { bil: number; pct: number; penalti: number };
  tandanLama:     { bil: number; pct: number; penalti: number };
  tandanDura:     { bil: number; pct: number; penalti: number };
  tandanTangkai:  { bil: number; pct: number; penalti: number };
  partenokarpi:   { bil: number; pct: number; penalti: number };
  jumlahC:        { bil: number; pct: number; penalti: number };
  jumlahBesar:    { bil: number; pct: number; penalti: number };
  goer:           number;
  catatan:        string;
  namaPenggred:   string;
  namaPemandu:    string;
  // Photos stored as Base64 strings — this is fine for a small number of images
  // If the app scales to hundreds of photos per day, migrate to S3/Cloudinary later
  photos:         string[];
  // Audit trail — when was this record created on the device vs synced to server
  deviceCreatedAt: Date;
  syncedAt:        Date;
  isEdited:    boolean;
  editCount:   number;
  editedAt:    Date | null;
  editHistory: {
    editedAt:   Date;
    editedBy:   string;  // user email for audit trail
    editCount:  number;
  }[];
}

const RecordSchema = new Schema<IRecord>({
  serialNo:        { type: String, required: true },
  millId:          { type: Schema.Types.ObjectId, ref: 'Mill', required: true },
  submittedBy:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date:            { type: String, required: true },
  time:            { type: String, required: true },
  namaLesen:       { type: String, required: true },
  noLesenMPOB:     { type: String, default: '' },
  noKenderaan:     { type: String, required: true },
  noTiketTimbang:  { type: Number, default: 0 },
  bilanganSampel:  { type: Number, default: 0 },
  beratBersih:     { type: Number, default: 0 },
  purataBerat:     { type: Number, default: 0 },
  boer:            { type: Number, default: 0 },
  bker:            { type: Number, default: 0 },
  tandanMasak:     { type: GradingRowSchema, default: () => ({}) },
  tandanMengkal:   { type: GradingRowSchema, default: () => ({}) },
  tandanBusuk:     { type: GradingRowSchema, default: () => ({}) },
  tandanKosong:    { type: GradingRowSchema, default: () => ({}) },
  jumlahB:         { type: GradingRowSchema, default: () => ({}) },
  tandanKotor:     { type: GradingRowSchema, default: () => ({}) },
  tandanLama:      { type: GradingRowSchema, default: () => ({}) },
  tandanDura:      { type: GradingRowSchema, default: () => ({}) },
  tandanTangkai:   { type: GradingRowSchema, default: () => ({}) },
  partenokarpi:    { type: GradingRowSchema, default: () => ({}) },
  jumlahC:         { type: GradingRowSchema, default: () => ({}) },
  jumlahBesar:     { type: GradingRowSchema, default: () => ({}) },
  goer:            { type: Number, default: 0 },
  catatan:         { type: String, default: '' },
  namaPenggred:    { type: String, default: '' },
  namaPemandu:     { type: String, default: '' },
  photos:          [{ type: String }],
  deviceCreatedAt: { type: Date, required: true },
  syncedAt:        { type: Date, default: Date.now },
  isEdited:    { type: Boolean, default: false },
  editCount:   { type: Number, default: 0 },
  editedAt:    { type: Date, default: null },
  editHistory: [{
    editedAt:  { type: Date },
    editedBy:  { type: String },
    editCount: { type: Number },
    oldValues: { type: Schema.Types.Mixed }, // Store the old values before edit for audit trail
    newValues: { type: Schema.Types.Mixed }, // Store the new values after edit for audit trail
    _id: false,
  }],
}, { timestamps: true });

// Compound index — ensures no duplicate serialNo within the same mill
// This is important for multi-tenancy: two mills can have the same serial number
// but within one mill every serial number must be unique
RecordSchema.index({ serialNo: 1, millId: 1 }, { unique: true });

export default mongoose.model<IRecord>('Record', RecordSchema);