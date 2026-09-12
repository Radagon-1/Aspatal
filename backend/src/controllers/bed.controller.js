import prisma from '../config/db.js';

export async function getBedsByHospital(req, res, next) {
  try {
    const { hospitalId } = req.params;
    const { bedType, status, ward } = req.query;
    const beds = await prisma.bed.findMany({
      where: {
        hospitalId,
        ...(bedType && { bedType }),
        ...(status && { status }),
        ...(ward && { wardName: { contains: ward, mode: 'insensitive' } }),
      },
      orderBy: [{ bedType: 'asc' }, { bedNumber: 'asc' }],
    });
    res.json(beds);
  } catch (err) { next(err); }
}

export async function getOccupancySummary(req, res, next) {
  try {
    const { hospitalId } = req.params;
    const summary = await prisma.bed.groupBy({
      by: ['bedType', 'status'],
      where: { hospitalId },
      _count: { id: true },
    });
    res.json(summary);
  } catch (err) { next(err); }
}

export async function getBed(req, res, next) {
  try {
    const bed = await prisma.bed.findUnique({
      where: { id: req.params.id },
      include: { admissions: { where: { status: 'ADMITTED' }, include: { patient: { select: { name: true, age: true } } } } },
    });
    if (!bed) return res.status(404).json({ error: 'Bed not found' });
    res.json(bed);
  } catch (err) { next(err); }
}

export async function getBeds(req, res, next) {
  try {
    // Bulk create beds
    const { beds } = req.body;
    const created = await prisma.bed.createMany({ data: beds, skipDuplicates: true });
    res.status(201).json(created);
  } catch (err) { next(err); }
}

export async function createBed(req, res, next) {
  try {
    const bed = await prisma.bed.create({ data: req.body });
    res.status(201).json(bed);
  } catch (err) { next(err); }
}

export async function updateBed(req, res, next) {
  try {
    const bed = await prisma.bed.update({ where: { id: req.params.id }, data: req.body });
    res.json(bed);
  } catch (err) { next(err); }
}

export async function updateBedStatus(req, res, next) {
  try {
    const { status } = req.body;
    const bed = await prisma.bed.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(bed);
  } catch (err) { next(err); }
}

export async function deleteBed(req, res, next) {
  try {
    await prisma.bed.delete({ where: { id: req.params.id } });
    res.json({ message: 'Bed deleted' });
  } catch (err) { next(err); }
}
