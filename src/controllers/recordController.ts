import { Response } from 'express';
import Record from '../models/Record';
import Conflict from '../models/Conflict';
import { AuthRequest, GradingRecordData } from '../types';

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
    if (JSON.stringify(oldVal ?? null) !== JSON.stringify(newVal ?? null)) {
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
    const results   = { synced: 0, failed: 0, conflicts: [] as string[], errors: [] as string[] };

    for (const record of records) {
      try {
        const existing = await Record.findOne({ serialNo: record.id, millId }).lean() as any;

        // ── Conflict detection ───────────────────────────────────────────────
        // A legitimate re-sync from the same device will always have the same
        // createdAt as the stored deviceCreatedAt (form.tsx preserves it on edit).
        // A different device will have a different createdAt — that is a collision.
        if (existing) {
          const existingTs = new Date(existing.deviceCreatedAt).getTime();
          const incomingTs = new Date(record.createdAt).getTime();
          const isCollision = Math.abs(existingTs - incomingTs) > 1000; // >1 second apart

          if (isCollision) {
            // Only save one conflict document per unique incoming createdAt.
            // This prevents duplicate conflicts if the grader retries sync.
            const alreadyExists = await Conflict.findOne({
              originalRecordId: existing._id,
              'conflictingData.createdAt': record.createdAt,
            });
            if (!alreadyExists) {
              await Conflict.create({
                originalRecordId: existing._id,
                serialNo:         record.id,
                millId,
                conflictingData:  record,
                submittedBy:      userId,
              });
            }
            results.conflicts.push(record.id);
            continue; // Do NOT overwrite the original record
          }
        }
        // ──────────────────────────────────────────────────────────────────────

        // Normal sync path — first-time upsert or same-device re-sync/edit
        let newEntries: any[] = [];
        const clientHistory: any[] = (record as any).editHistory ?? [];

        if (clientHistory.length > 0) {
          const existingCounts = new Set<number>(
            (existing?.editHistory ?? []).map((e: any) => e.editCount)
          );
          newEntries = clientHistory
            .filter((e: any) => !existingCounts.has(e.editCount))
            .map((e: any) => ({
              editedAt:  new Date(e.editedAt),
              editedBy:  userEmail,
              editCount: e.editCount,
              oldValues: e.oldValues,
              newValues: e.newValues,
            }));
        } else if (record.isEdited && existing) {
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
              syncedAt:        new Date(),
              isEdited:        record.isEdited  ?? false,
              editCount:       record.editCount ?? 0,
              editedAt:        record.editedAt  ? new Date(record.editedAt) : null,
            },
            // $setOnInsert only runs on a brand-new upsert insert, never on update.
            // This means deviceCreatedAt is locked to the first device's createdAt
            // and cannot be overwritten by a re-sync from the same device.
            $setOnInsert: {
              deviceCreatedAt: new Date(record.createdAt),
            },
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

// Lightweight fetch — excludes the photos field.
// Called by the mobile app on login to seed SQLite and calibrate
// the serial number counter without downloading all Base64 image data.
export const getLiteRecords = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const millId = req.user!.millId;
    const records = await Record.find({ millId })
      .select('-photos')
      .sort({ deviceCreatedAt: -1 })
      .lean();
    res.status(200).json({ success: true, records });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Ralat pelayan.' });
  }
};

// Returns all unresolved conflicts for this mill (manager/admin only).
export const getConflicts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const millId = req.user!.millId;
    const conflicts = await Conflict.find({ millId, resolution: null })
      .populate('originalRecordId')
      .populate('submittedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, conflicts });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Ralat pelayan.' });
  }
};

// Three resolution actions:
// keep_original — discard the conflict, original record wins
// use_new       — replace original record's data with the conflict data
// assign_new_serial — promote conflict data to a brand-new record with a new number
export const resolveConflict = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, newSerialNo } = req.body as {
      action: 'keep_original' | 'use_new' | 'assign_new_serial';
      newSerialNo?: string;
    };

    const millId = req.user!.millId;
    const userId = req.user!.id;

    const conflict = await Conflict.findOne({ _id: id, millId });
    if (!conflict) {
      res.status(404).json({ success: false, message: 'Konflik tidak dijumpai.' });
      return;
    }
    if (conflict.resolution !== null) {
      res.status(400).json({ success: false, message: 'Konflik ini sudah diselesaikan.' });
      return;
    }

    if (action === 'use_new') {
      const d = conflict.conflictingData as any;
      await Record.updateOne(
        { _id: conflict.originalRecordId },
        {
          $set: {
            date: d.date, time: d.time, namaLesen: d.namaLesen,
            noLesenMPOB: d.noLesenMPOB, noKenderaan: d.noKenderaan,
            noTiketTimbang: d.noTiketTimbang, bilanganSampel: d.bilanganSampel,
            beratBersih: d.beratBersih, purataBerat: d.purataBerat,
            boer: d.boer, bker: d.bker,
            tandanMasak: d.tandanMasak, tandanMengkal: d.tandanMengkal,
            tandanBusuk: d.tandanBusuk, tandanKosong: d.tandanKosong,
            jumlahB: d.jumlahB, tandanKotor: d.tandanKotor,
            tandanLama: d.tandanLama, tandanDura: d.tandanDura,
            tandanTangkai: d.tandanTangkai, partenokarpi: d.partenokarpi,
            jumlahC: d.jumlahC, jumlahBesar: d.jumlahBesar,
            goer: d.goer, catatan: d.catatan,
            namaPenggred: d.namaPenggred, namaPemandu: d.namaPemandu,
            photos: (d.photos || []).filter(Boolean),
            syncedAt: new Date(),
          },
        }
      );
    } else if (action === 'assign_new_serial') {
      if (!newSerialNo) {
        res.status(400).json({ success: false, message: 'newSerialNo diperlukan.' });
        return;
      }
      const d = conflict.conflictingData as any;
      await Record.create({
        serialNo: newSerialNo, millId,
        submittedBy: conflict.submittedBy,
        date: d.date, time: d.time, namaLesen: d.namaLesen,
        noLesenMPOB: d.noLesenMPOB, noKenderaan: d.noKenderaan,
        noTiketTimbang: d.noTiketTimbang, bilanganSampel: d.bilanganSampel,
        beratBersih: d.beratBersih, purataBerat: d.purataBerat,
        boer: d.boer, bker: d.bker,
        tandanMasak: d.tandanMasak, tandanMengkal: d.tandanMengkal,
        tandanBusuk: d.tandanBusuk, tandanKosong: d.tandanKosong,
        jumlahB: d.jumlahB, tandanKotor: d.tandanKotor,
        tandanLama: d.tandanLama, tandanDura: d.tandanDura,
        tandanTangkai: d.tandanTangkai, partenokarpi: d.partenokarpi,
        jumlahC: d.jumlahC, jumlahBesar: d.jumlahBesar,
        goer: d.goer, catatan: d.catatan,
        namaPenggred: d.namaPenggred, namaPemandu: d.namaPemandu,
        photos: (d.photos || []).filter(Boolean),
        deviceCreatedAt: new Date(d.createdAt),
        syncedAt: new Date(),
        isEdited: false, editCount: 0, editedAt: null, editHistory: [],
      });
      conflict.newSerialNo = newSerialNo;
    }
    // keep_original: no record changes needed

    conflict.resolution = action;
    conflict.resolvedAt = new Date();
    conflict.resolvedBy = userId as any;
    await conflict.save();

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Resolve conflict error:', err);
    res.status(500).json({ success: false, message: 'Ralat pelayan.' });
  }
};