import { Request } from 'express';

// We extend Express's Request interface rather than creating a new one
// from scratch. This means AuthRequest has ALL the standard Request
// properties (body, query, params, headers, etc.) plus our custom
// user property. The ? means user is optional — before the protect
// middleware runs, req.user doesn't exist yet.
export interface AuthRequest extends Request {
  user?: {
    id:     string;
    email:  string;
    role:   'grader' | 'manager' | 'admin';
    millId: string;
  };
}

export interface GradingRowData {
  bil:     number;
  pct:     number;
  penalti: number;
}

export interface GradingRecordData {
  id:             string;
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
  tandanMasak:    GradingRowData;
  tandanMengkal:  GradingRowData;
  tandanBusuk:    GradingRowData;
  tandanKosong:   GradingRowData;
  jumlahB:        GradingRowData;
  tandanKotor:    GradingRowData;
  tandanLama:     GradingRowData;
  tandanDura:     GradingRowData;
  tandanTangkai:  GradingRowData;
  partenokarpi:   GradingRowData;
  jumlahC:        GradingRowData;
  jumlahBesar:    GradingRowData;
  goer:           number;
  catatan:        string;
  namaPenggred:   string;
  namaPemandu:    string;
  photos:         (string | null)[];
  createdAt:      string;
  editedAt?:      string | null;
  editCount?:     number;
  isEdited?:      boolean;
}