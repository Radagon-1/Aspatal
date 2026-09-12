import prisma from '../config/db.js';

export async function registerAshaWorker(req, res, next) {
  try {
    const { userId, ...data } = req.body;
    const worker = await prisma.ashaWorker.create({
      data: { userId, ...data },
    });
    // Update user role
    await prisma.user.update({ where: { id: userId }, data: { role: 'ASHA_WORKER' } });
    res.status(201).json(worker);
  } catch (err) { next(err); }
}

export async function getAshaWorker(req, res, next) {
  try {
    const worker = await prisma.ashaWorker.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { email: true, phone: true } } },
    });
    if (!worker) return res.status(404).json({ error: 'ASHA worker not found' });
    res.json(worker);
  } catch (err) { next(err); }
}

export async function updateAshaWorker(req, res, next) {
  try {
    const worker = await prisma.ashaWorker.update({ where: { id: req.params.id }, data: req.body });
    res.json(worker);
  } catch (err) { next(err); }
}

export async function getAshaWorkerPatients(req, res, next) {
  try {
    const visits = await prisma.ashaVisit.findMany({
      where: { ashaWorkerId: req.params.id, patientId: { not: null } },
      distinct: ['patientId'],
      include: { patient: { select: { id: true, name: true, age: true, phone: true, isHighRisk: true } } },
    });
    const patients = visits.map(v => v.patient).filter(Boolean);
    res.json(patients);
  } catch (err) { next(err); }
}

export async function createAshaVisit(req, res, next) {
  try {
    const visit = await prisma.ashaVisit.create({ data: req.body });
    res.status(201).json(visit);
  } catch (err) { next(err); }
}

export async function getAshaVisits(req, res, next) {
  try {
    const visits = await prisma.ashaVisit.findMany({
      where: { ashaWorkerId: req.params.id },
      orderBy: { visitDate: 'desc' },
      include: { patient: { select: { name: true, age: true } } },
    });
    res.json(visits);
  } catch (err) { next(err); }
}

/**
 * Sync offline visits — accepts an array of visit records created offline
 * and upserts them. Records with isSynced=false get marked as synced.
 */
export async function syncAshaVisits(req, res, next) {
  try {
    const { visits } = req.body; // array of visit objects
    if (!Array.isArray(visits) || visits.length === 0) {
      return res.status(400).json({ error: 'visits array is required' });
    }

    const results = await Promise.allSettled(
      visits.map((v) =>
        prisma.ashaVisit.upsert({
          where: { id: v.id || '' },
          create: { ...v, isSynced: true },
          update: { isSynced: true },
        })
      )
    );

    const synced = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    res.json({ synced, failed, total: visits.length });
  } catch (err) { next(err); }
}
