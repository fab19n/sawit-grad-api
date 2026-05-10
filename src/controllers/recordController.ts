import { Response } from 'express';
import Record from '../models/Record';
import { AuthRequest, GradingRecordData } from '../types';

export const syncRecords = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { records } = req.body as { records: GradingRecordData[] };
    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({ success: false, message: 'Tiada rekod untuk disegerakkan.' });
      return;
    }

    const millId    = req.user!.millId;
    const userId    = req.user!.id;
    const results   = { synced: 0, failed: 0, errors: [] as string[] };

    for (const record of records) {
      try {
        // Use updateOne with upsert: true — if the record already exists
        // (identified by serialNo + millId), update it. If not, insert it.
        // This makes the sync operation idempotent — safe to call multiple times
        // with the same data without creating duplicates.
        await Record.updateOne(
          { serialNo: record.id, millId },
          {
            $set: {
              millId,
              submittedBy:    userId,
              serialNo:       record.id,
              date:           record.date,
              time:           record.time,
              namaLesen:      record.namaLesen,
              noLesenMPOB:    record.noLesenMPOB,
              noKenderaan:    record.noKenderaan,
              noTiketTimbang: record.noTiketTimbang,
              bilanganSampel: record.bilanganSampel,
              beratBersih:    record.beratBersih,
              purataBerat:    record.purataBerat,
              boer:           record.boer,
              bker:           record.bker,
              tandanMasak:    record.tandanMasak,
              tandanMengkal:  record.tandanMengkal,
              tandanBusuk:    record.tandanBusuk,
              tandanKosong:   record.tandanKosong,
              jumlahB:        record.jumlahB,
              tandanKotor:    record.tandanKotor,
              tandanLama:     record.tandanLama,
              tandanDura:     record.tandanDura,
              tandanTangkai:  record.tandanTangkai,
              partenokarpi:   record.partenokarpi,
              jumlahC:        record.jumlahC,
              jumlahBesar:    record.jumlahBesar,
              goer:           record.goer,
              catatan:        record.catatan,
              namaPenggred:   record.namaPenggred,
              namaPemandu:    record.namaPemandu,
              // Filter out null photo slots before storing
              photos:         (record.photos || []).filter(Boolean) as string[],
              deviceCreatedAt: new Date(record.createdAt),
              syncedAt:        new Date(),
            },
          },
          { upsert: true }
        );
        results.synced++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Record ${record.id}: ${err.message}`);
      }
    }

    res.status(200).json({ success: true, results });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ success: false, message: 'Ralat segerak.' });
  }
};

export const getRecords = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const millId = req.user!.millId;
    const { page = 1, limit = 50, date } = req.query;

    // Every query is scoped to millId — a grader from Mill A
    // can never accidentally see Mill B's records
    const query: any = { millId };
    if (date) query.date = date;

    const records = await Record.find(query)
      .sort({ deviceCreatedAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .populate('submittedBy', 'name email');

    const total = await Record.countDocuments(query);

    res.status(200).json({
      success: true,
      records,
      pagination: { page: Number(page), limit: Number(limit), total },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Ralat pelayan.' });
  }
};