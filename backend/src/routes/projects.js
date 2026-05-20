import { Router } from 'express';
import { body, param } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { authenticate, getProjectMembership, requireAdmin } from '../middleware/auth.js';
import { handleValidation } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

const memberInclude = {
  user: { select: { id: true, name: true, email: true } },
};

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Project name is required'),
    body('description').optional().trim(),
  ],
  handleValidation,
  async (req, res) => {
    const { name, description } = req.body;

    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
        creatorId: req.userId,
        members: {
          create: { userId: req.userId, role: 'ADMIN' },
        },
      },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        members: { include: memberInclude },
        _count: { select: { tasks: true } },
      },
    });

    res.status(201).json({ project: formatProject(project, req.userId) });
  }
);

router.get('/', async (req, res) => {
  const memberships = await prisma.projectMember.findMany({
    where: { userId: req.userId },
    include: {
      project: {
        include: {
          creator: { select: { id: true, name: true, email: true } },
          members: { include: memberInclude },
          _count: { select: { tasks: true } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  const projects = memberships.map((m) =>
    formatProject(m.project, req.userId, m.role)
  );
  res.json({ projects });
});

router.get(
  '/:projectId',
  [param('projectId').notEmpty()],
  handleValidation,
  async (req, res) => {
    const membership = await getProjectMembership(req.params.projectId, req.userId);
    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this project' });
    }

    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        members: { include: memberInclude },
        _count: { select: { tasks: true } },
      },
    });

    res.json({ project: formatProject(project, req.userId, membership.role) });
  }
);

router.post(
  '/:projectId/members',
  [
    param('projectId').notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('role').optional().isIn(['ADMIN', 'MEMBER']),
  ],
  handleValidation,
  async (req, res) => {
    const { projectId } = req.params;
    const membership = await getProjectMembership(projectId, req.userId);
    if (!requireAdmin(membership)) {
      return res.status(403).json({ error: 'Only admins can manage members' });
    }

    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found with that email' });
    }

    const existing = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: user.id, projectId } },
    });
    if (existing) {
      return res.status(409).json({ error: 'User is already a project member' });
    }

    const member = await prisma.projectMember.create({
      data: {
        userId: user.id,
        projectId,
        role: req.body.role || 'MEMBER',
      },
      include: memberInclude,
    });

    res.status(201).json({ member });
  }
);

router.delete(
  '/:projectId/members/:userId',
  [param('projectId').notEmpty(), param('userId').notEmpty()],
  handleValidation,
  async (req, res) => {
    const { projectId, userId } = req.params;
    const membership = await getProjectMembership(projectId, req.userId);
    if (!requireAdmin(membership)) {
      return res.status(403).json({ error: 'Only admins can remove members' });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project.creatorId === userId) {
      return res.status(400).json({ error: 'Cannot remove the project creator' });
    }

    const target = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });
    if (!target) {
      return res.status(404).json({ error: 'Member not found' });
    }

    await prisma.projectMember.delete({
      where: { userId_projectId: { userId, projectId } },
    });

    res.json({ message: 'Member removed' });
  }
);

function formatProject(project, userId, roleOverride) {
  const myMembership = project.members.find((m) => m.userId === userId);
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    creator: project.creator,
    members: project.members.map((m) => ({
      id: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      user: m.user,
    })),
    taskCount: project._count?.tasks ?? 0,
    myRole: roleOverride || myMembership?.role,
    createdAt: project.createdAt,
  };
}

export default router;
