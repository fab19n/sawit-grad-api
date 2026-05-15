import { Response } from 'express';
import Record from '../models/Record';
import { AuthRequest, GradingRecordData } from '../types';

// ── Module-level constants — accessible by all functions ──────────────────
const TRACKED_FIELDS = [
  'namaLesen', 'noLesenMPOB', 'noKenderaan', 'noTiketTimbang',
  'bilanganSampel', 'beratBersih', 'purataBerat', 'boer', 'bker',
  'tandanMasak', 'tandanMengkal', 'tandanBusuk', 'tandanKosong',
  'tandanKotor', 'tandanLama', 'tandanDura', 'tandanTangkai',
  'partenokarpi', 'goer', 'catatan', 'namaPenggred', 'namaPemandu',
];

function computeDiff(
  oldDoc: any,
  newData: any
): { oldValues: Record<string, any>; newValues: Record<string, any> } {
  const oldValues: Record<string, any> = {};
  const newValues: Record<string, any> = {};

  for (const field of TRACKED_FIELDS) {
    const oldVal = oldDoc?.[field];
    const newVal = newData[field];
    const oldStr = JSON.stringify(oldVal ?? null);
    const newStr = JSON.stringify(newVal ?? null);
    if (oldStr !== newStr) {
      oldValues[field] = oldVal ?? null;
      newValues[field] = newVal ?? null;
    }
  }

  return { oldValues, newValues };
}

// ─────────────────────────────────────────────────────────────────────────────

export const syncRecords = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { records } = req.body as { records: GradingRecordData[] };
    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({ success: false, message: 'Tiada rekod untuk disegerakkan.' });
      return;
    }

    const millId    = req.user!.millId;
    const userId    = req.user!.id;
    const userEmail = req.user!.email;
    const results   = { synced: 0, failed: 0, errors: [] as string[] };

    for (const record of records) {
      try {
        // Fetch the existing MongoDB document so we know which editHistory
        // entries have already been stored (by editCount).
        const existing = await Record.findOne({ serialNo: record.id, millId }).lean() as any;

        // ── Determine new editHistory entries to push ──────────────────────
        // The mobile app now builds editHistory locally (one entry per edit
        // session).  We only push entries whose editCount is not already
        // present in MongoDB, so re-syncing the same record is idempotent.
        //
        // Fallback: if the app has not sent editHistory (old app version) but
        // the record is flagged as edited, fall back to the server-side diff
        // so behaviour is unchanged for those older records.
        let newEntries: any[] = [];

        const clientHistory: any[] = (record as any).editHistory ?? [];

        if (clientHistory.length > 0) {
          // New path — use the per-edit diffs from the mobile app.
          const existingCounts = new Set<number>(
            (existing?.editHistory ?? []).map((e: any) => e.editCount)
          );
          newEntries = clientHistory
            .filter((e: any) => !existingCounts.has(e.editCount))
            .map((e: any) => ({
              editedAt:  new Date(e.editedAt),
              editedBy:  userEmail,          // always set from JWT — never trust client
              editCount: e.editCount,
              oldValues: e.oldValues,
              newValues: e.newValues,
            }));
        } else if (record.isEdited && existing) {
          // Legacy fallback — older app build without local editHistory.
          // Compute a single diff exactly as before.
          const { oldValues, newValues } = computeDiff(existing, record);
          if (Object.keys(oldValues).length > 0) {
            const existingCounts = new Set<number>(
              (existing.editHistory ?? []).map((e: any) => e.editCount)
            );
            const editCount = record.editCount ?? 1;
            if (!existingCounts.has(editCount)) {
              newEntries = [{
                editedAt:  new Date(record.editedAt || Date.now()),
                editedBy:  userEmail,
                editCount,
                oldValues,
                newValues,
              }];
            }
          }
        }
        // ──────────────────────────────────────────────────────────────────

        await Record.updateOne(
          { serialNo: record.id, millId },
          {
            $set: {
              millId,
              submittedBy:     userId,
              serialNo:        record.id,
              date:            record.date,
              time:            record.time,
              namaLesen:       record.namaLesen,
              noLesenMPOB:     record.noLesenMPOB,
              noKenderaan:     record.noKenderaan,
              noTiketTimbang:  record.noTiketTimbang,
              bilanganSampel:  record.bilanganSampel,
              beratBersih:     record.beratBersih,
              purataBerat:     record.purataBerat,
              boer:            record.boer,
              bker:            record.bker,
              tandanMasak:     record.tandanMasak,
              tandanMengkal:   record.tandanMengkal,
              tandanBusuk:     record.tandanBusuk,
              tandanKosong:    record.tandanKosong,
              jumlahB:         record.jumlahB,
              tandanKotor:     record.tandanKotor,
              tandanLama:      record.tandanLama,
              tandanDura:      record.tandanDura,
              tandanTangkai:   record.tandanTangkai,
              partenokarpi:    record.partenokarpi,
              jumlahC:         record.jumlahC,
              jumlahBesar:     record.jumlahBesar,
              goer:            record.goer,
              catatan:         record.catatan,
              namaPenggred:    record.namaPenggred,
              namaPemandu:     record.namaPemandu,
              photos:          (record.photos || []).filter(Boolean) as string[],
              deviceCreatedAt: new Date(record.createdAt),
              syncedAt:        new Date(),
              isEdited:        record.isEdited  ?? false,
              editCount:       record.editCount ?? 0,
              editedAt:        record.editedAt  ? new Date(record.editedAt) : null,
            },
            // Push all new history entries in a single atomic operation.
            // $each with an empty array is a no-op, so no guard needed.
            $push: { editHistory: { $each: newEntries } },
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