import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';

export async function createVisit(req, res, next) {
  try {
    const visit = await prisma.visit.create({ data: req.body });

    // Auto-flag high-risk if needed
    if (req.body.toBeAdmitted || req.body.needsReferral) {
      await prisma.patient.update({
        where: { id: req.body.patientId },
        data: { isHighRisk: true },
      });
    }

    res.status(201).json(visit);
  } catch (err) { next(err); }
}

export async function getVisit(req, res, next) {
  try {
    const visit = await prisma.visit.findUnique({
      where: { id: req.params.id },
      include: {
        patient: { select: { id: true, name: true, age: true, gender: true } },
        doctor: { select: { id: true, name: true, specialization: true } },
        hospital: { select: { id: true, name: true } },
        referral: true,
        followUp: true,
        admission: true,
      },
    });
    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    res.json(visit);
  } catch (err) { next(err); }
}

export async function getVisitsByPatient(req, res, next) {
  try {
    const { skip, take, page, limit } = paginate(req.query);
    const where = { patientId: req.params.patientId };
    const [visits, total] = await Promise.all([
      prisma.visit.findMany({
        where, skip, take,
        orderBy: { visitDate: 'desc' },
        include: {
          doctor: { select: { name: true, specialization: true } },
          hospital: { select: { name: true } },
        },
      }),
      prisma.visit.count({ where }),
    ]);
    res.json(paginatedResponse(visits, total, { page, limit }));
  } catch (err) { next(err); }
}

export async function getVisitsByDoctor(req, res, next) {
  try {
    const { skip, take, page, limit } = paginate(req.query);
    const where = { doctorId: req.params.doctorId };
    const [visits, total] = await Promise.all([
      prisma.visit.findMany({
        where, skip, take,
        orderBy: { visitDate: 'desc' },
        include: { patient: { select: { name: true, age: true } } },
      }),
      prisma.visit.count({ where }),
    ]);
    res.json(paginatedResponse(visits, total, { page, limit }));
  } catch (err) { next(err); }
}

export async function updateVisit(req, res, next) {
  try {
    const visit = await prisma.visit.update({ where: { id: req.params.id }, data: req.body });
    res.json(visit);
  } catch (err) { next(err); }
}
