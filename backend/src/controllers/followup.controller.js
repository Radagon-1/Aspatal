import prisma from '../config/db.js';

export async function createFollowUp(req, res, next) {
  try {
    const followUp = await prisma.followUp.create({ data: req.body });
    res.status(201).json(followUp);
  } catch (err) { next(err); }
}

export async function getFollowUp(req, res, next) {
  try {
    const followUp = await prisma.followUp.findUnique({
      where: { id: req.params.id },
      include: { patient: { select: { name: true } }, visit: { include: { doctor: { select: { name: true } } } } },
    });
    if (!followUp) return res.status(404).json({ error: 'Follow-up not found' });
    res.json(followUp);
  } catch (err) { next(err); }
}

export async function getFollowUpsByPatient(req, res, next) {
  try {
    const followUps = await prisma.followUp.findMany({
      where: { patientId: req.params.patientId },
      orderBy: { scheduledDate: 'desc' },
    });
    res.json(followUps);
  } catch (err) { next(err); }
}

export async function getUpcomingFollowUps(req, res, next) {
  try {
    const followUps = await prisma.followUp.findMany({
      where: {
        isCompleted: false,
        scheduledDate: { gte: new Date() },
        visit: { hospitalId: req.params.hospitalId },
      },
      orderBy: { scheduledDate: 'asc' },
      include: { patient: { select: { name: true, phone: true } } },
      take: 50,
    });
    res.json(followUps);
  } catch (err) { next(err); }
}

export async function markFollowUpComplete(req, res, next) {
  try {
    const followUp = await prisma.followUp.update({
      where: { id: req.params.id },
      data: { isCompleted: true, completedAt: new Date(), notes: req.body.notes },
    });
    res.json(followUp);
  } catch (err) { next(err); }
}
