import { Request } from 'express';

// Extends the standard Express Request to include our authenticated user
// After the auth middleware runs, req.user will always be populated
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
}