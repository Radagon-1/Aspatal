import prisma from '../config/db.js';

export async function admitPatient(req, res, next) {
  try {
    const admission = await prisma.$transaction(async (tx) => {
      const { bedId, ...data } = req.body;

      // Mark bed as occupied
      if (bedId) {
        await tx.bed.update({ where: { id: bedId }, data: { status: 'OCCUPIED' } });
      }

      return tx.admission.create({
        data: { ...data, bedId },
        include: { patient: { select: { name: true } }, bed: true, hospital: { select: { name: true } } },
      });
    });
    res.status(201).json(admission);
  } catch (err) { next(err); }
}

export async function dischargePatient(req, res, next) {
  try {
    const admission = await prisma.$transaction(async (tx) => {
      const existing = await tx.admission.findUnique({ where: { id: req.params.id } });
      if (!existing) throw Object.assign(new Error('Admission not found'), { status: 404 });

      // Free the bed
      if (existing.bedId) {
        await tx.bed.update({ where: { id: existing.bedId }, data: { status: 'AVAILABLE' } });
      }

      return tx.admission.update({
        where: { id: req.params.id },
        data: { status: 'DISCHARGED', dischargedAt: new Date(), notes: req.body.notes },
      });
    });
    res.json(admission);
  } catch (err) { next(err); }
}

export async function transferPatient(req, res, next) {
  try {
    const admission = await prisma.admission.update({
      where: { id: req.params.id },
      data: { status: 'TRANSFERRED', dischargedAt: new Date(), notes: req.body.notes },
    });
    res.json(admission);
  } catch (err) { next(err); }
}

export async function getAdmission(req, res, next) {
  try {
    const admission = await prisma.admission.findUnique({
      where: { id: req.params.id },
      include: {
        patient: true,
        hospital: { select: { name: true } },
        bed: true,
        visit: { include: { doctor: { select: { name: true } } } },
      },
    });
    if (!admission) return res.status(404).json({ error: 'Admission not found' });
    res.json(admission);
  } catch (err) { next(err); }
}

export async function getAdmissionsByHospital(req, res, next) {
  try {
    const { status } = req.query;
    const admissions = await prisma.admission.findMany({
      where: { hospitalId: req.params.hospitalId, ...(status && { status }) },
      orderBy: { admittedAt: 'desc' },
      include: { patient: { select: { name: true, age: true, gender: true } }, bed: true },
    });
    res.json(admissions);
  } catch (err) { next(err); }
}

export async function getActiveAdmissions(req, res, next) {
  try {
    const admissions = await prisma.admission.findMany({
      where: { hospitalId: req.params.hospitalId, status: 'ADMITTED' },
      include: { patient: { select: { name: true, age: true, gender: true } }, bed: true },
    });
    res.json(admissions);
  } catch (err) { next(err); }
}
