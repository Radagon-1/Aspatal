import prisma from '../config/db.js';

// Valid referral state transitions
const VALID_TRANSITIONS = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export async function createReferral(req, res, next) {
  try {
    const referral = await prisma.referral.create({
      data: req.body,
      include: {
        fromHospital: { select: { name: true } },
        toHospital: { select: { name: true } },
        referredBy: { select: { name: true, specialization: true } },
        patient: { select: { name: true } },
      },
    });
    res.status(201).json(referral);
  } catch (err) { next(err); }
}

export async function getReferral(req, res, next) {
  try {
    const referral = await prisma.referral.findUnique({
      where: { id: req.params.id },
      include: {
        patient: true,
        fromHospital: true,
        toHospital: true,
        referredBy: { select: { name: true, specialization: true } },
        referredTo: { select: { name: true, specialization: true } },
        visit: true,
      },
    });
    if (!referral) return res.status(404).json({ error: 'Referral not found' });
    res.json(referral);
  } catch (err) { next(err); }
}

export async function getReferralsByPatient(req, res, next) {
  try {
    const referrals = await prisma.referral.findMany({
      where: { patientId: req.params.patientId },
      orderBy: { referredAt: 'desc' },
      include: {
        fromHospital: { select: { name: true } },
        toHospital: { select: { name: true } },
        referredBy: { select: { name: true } },
      },
    });
    res.json(referrals);
  } catch (err) { next(err); }
}

export async function getReferralsByHospital(req, res, next) {
  try {
    const { type = 'from' } = req.query; // 'from' or 'to'
    const key = type === 'to' ? 'toHospitalId' : 'fromHospitalId';
    const referrals = await prisma.referral.findMany({
      where: { [key]: req.params.hospitalId },
      orderBy: { referredAt: 'desc' },
      include: {
        patient: { select: { name: true, age: true } },
        fromHospital: { select: { name: true } },
        toHospital: { select: { name: true } },
        referredBy: { select: { name: true } },
      },
    });
    res.json(referrals);
  } catch (err) { next(err); }
}

export async function updateReferralStatus(req, res, next) {
  try {
    const { status } = req.body;
    const referral = await prisma.referral.findUnique({ where: { id: req.params.id } });
    if (!referral) return res.status(404).json({ error: 'Referral not found' });

    // Validate state transition
    const allowed = VALID_TRANSITIONS[referral.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Cannot transition from ${referral.status} to ${status}. Allowed: ${allowed.join(', ')}`,
      });
    }

    const updated = await prisma.referral.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(status === 'ACCEPTED' && { acceptedAt: new Date() }),
        ...(status === 'COMPLETED' && { completedAt: new Date() }),
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
}

export async function getReferralStats(req, res, next) {
  try {
    const { hospitalId } = req.params;
    const stats = await prisma.referral.groupBy({
      by: ['status'],
      where: { fromHospitalId: hospitalId },
      _count: { id: true },
    });
    res.json(stats);
  } catch (err) { next(err); }
}
