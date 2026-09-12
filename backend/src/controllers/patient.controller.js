import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';

export async function createPatient(req, res, next) {
  try {
    const { userId, ...data } = req.body;
    const uid = userId || req.user.id;

    // Link to current user if patient role
    const patient = await prisma.patient.create({
      data: { ...data, userId: uid },
    });
    res.status(201).json(patient);
  } catch (err) { next(err); }
}

export async function getPatients(req, res, next) {
  try {
    const { skip, take, page, limit } = paginate(req.query);
    const { hospitalId } = req.query;

    const where = { ...(hospitalId && { hospitalId }) };
    const [patients, total] = await Promise.all([
      prisma.patient.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      prisma.patient.count({ where }),
    ]);
    res.json(paginatedResponse(patients, total, { page, limit }));
  } catch (err) { next(err); }
}

export async function getPatient(req, res, next) {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id },
      include: { hospital: { select: { id: true, name: true } } },
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json(patient);
  } catch (err) { next(err); }
}

export async function getPatientHistory(req, res, next) {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id },
      include: {
        visits: {
          orderBy: { visitDate: 'desc' },
          include: {
            doctor: { select: { name: true, specialization: true } },
            hospital: { select: { name: true, city: true } },
            referral: true,
            followUp: true,
          },
        },
        admissions: {
          orderBy: { admittedAt: 'desc' },
          include: { hospital: { select: { name: true } }, bed: true },
        },
        referrals: {
          orderBy: { referredAt: 'desc' },
          include: {
            fromHospital: { select: { name: true } },
            toHospital: { select: { name: true } },
            referredBy: { select: { name: true, specialization: true } },
          },
        },
        triageRecords: { orderBy: { triageDate: 'desc' }, take: 5 },
        followUps: { where: { isCompleted: false }, orderBy: { scheduledDate: 'asc' } },
      },
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json(patient);
  } catch (err) { next(err); }
}

export async function searchPatients(req, res, next) {
  try {
    const { q, hospitalId } = req.query;
    const patients = await prisma.patient.findMany({
      where: {
        ...(hospitalId && { hospitalId }),
        OR: q ? [
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
          { email: { contains: q, mode: 'insensitive' } },
        ] : undefined,
      },
      take: 20,
    });
    res.json(patients);
  } catch (err) { next(err); }
}

export async function getHighRiskPatients(req, res, next) {
  try {
    const { hospitalId } = req.query;
    const { skip, take, page, limit } = paginate(req.query);

    const where = { isHighRisk: true, ...(hospitalId && { hospitalId }) };
    const [patients, total] = await Promise.all([
      prisma.patient.findMany({ where, skip, take }),
      prisma.patient.count({ where }),
    ]);
    res.json(paginatedResponse(patients, total, { page, limit }));
  } catch (err) { next(err); }
}

export async function updatePatient(req, res, next) {
  try {
    const patient = await prisma.patient.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(patient);
  } catch (err) { next(err); }
}
