import { Router } from 'express';
import { body, param } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { authenticate, getProjectMembership, requireAdmin } from '../middleware/auth.js';
import { handleValidation } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

const taskInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  creator: { select: { id: true, name: true, email: true } },
};

function formatTask(task) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    dueDate: task.dueDate,
    priority: task.priority,
    status: task.status,
    projectId: task.projectId,
    assignee: task.assignee,
    creator: task.creator,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    isOverdue:
      task.dueDate &&
      task.status !== 'DONE' &&
      new Date(task.dueDate) < new Date(new Date().toDateString()),
  };
}

async function assertProjectAccess(projectId, userId) {
  const membership = await getProjectMembership(projectId, userId);
  if (!membership) {
    const err = new Error('FORBIDDEN');
    err.status = 403;
    err.message = 'You are not a member of this project';
    throw err;
  }
  return membership;
}

router.get(
  '/project/:projectId',
  [param('projectId').notEmpty()],
  handleValidation,
  async (req, res) => {
    try {
      const membership = await assertProjectAccess(req.params.projectId, req.userId);
      const isAdmin = requireAdmin(membership);

      const tasks = await prisma.task.findMany({
        where: {
          projectId: req.params.projectId,
          ...(isAdmin ? {} : { assigneeId: req.userId }),
        },
        include: taskInclude,
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      });

      res.json({ tasks: tasks.map(formatTask), myRole: membership.role });
    } catch (e) {
      if (e.message === 'FORBIDDEN') return res.status(403).json({ error: e.message });
      throw e;
    }
  }
);

router.post(
  '/project/:projectId',
  [
    param('projectId').notEmpty(),
    body('title').trim().notEmpty(),
    body('description').optional().trim(),
    body('dueDate').optional().isISO8601(),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    body('assigneeId').optional().isString(),
    body('status').optional().isIn(['TODO', 'IN_PROGRESS', 'DONE']),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const membership = await assertProjectAccess(req.params.projectId, req.userId);
      if (!requireAdmin(membership)) {
        return res.status(403).json({ error: 'Only admins can create tasks' });
      }

      const { title, description, dueDate, priority, assigneeId, status } = req.body;

      if (assigneeId) {
        const assigneeMember = await prisma.projectMember.findUnique({
          where: {
            userId_projectId: { userId: assigneeId, projectId: req.params.projectId },
          },
        });
        if (!assigneeMember) {
          return res.status(400).json({ error: 'Assignee must be a project member' });
        }
      }

      const task = await prisma.task.create({
        data: {
          title,
          description: description || null,
          dueDate: dueDate ? new Date(dueDate) : null,
          priority: priority || 'MEDIUM',
          status: status || 'TODO',
          projectId: req.params.projectId,
          assigneeId: assigneeId || null,
          createdById: req.userId,
        },
        include: taskInclude,
      });

      res.status(201).json({ task: formatTask(task) });
    } catch (e) {
      if (e.message === 'FORBIDDEN') return res.status(403).json({ error: e.message });
      throw e;
    }
  }
);

router.patch(
  '/:taskId',
  [
    param('taskId').notEmpty(),
    body('title').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('dueDate').optional({ nullable: true }).isISO8601(),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    body('status').optional().isIn(['TODO', 'IN_PROGRESS', 'DONE']),
    body('assigneeId').optional({ nullable: true }).isString(),
  ],
  handleValidation,
  async (req, res) => {
    const task = await prisma.task.findUnique({
      where: { id: req.params.taskId },
      include: { project: true },
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const membership = await getProjectMembership(task.projectId, req.userId);
    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this project' });
    }

    const isAdmin = requireAdmin(membership);
    const isAssignee = task.assigneeId === req.userId;

    if (!isAdmin && !isAssignee) {
      return res.status(403).json({ error: 'You can only update tasks assigned to you' });
    }

    if (!isAdmin) {
      const allowed = ['status'];
      const keys = Object.keys(req.body).filter((k) => req.body[k] !== undefined);
      if (keys.some((k) => !allowed.includes(k))) {
        return res.status(403).json({ error: 'Members can only update task status' });
      }
    }

    if (req.body.assigneeId !== undefined && req.body.assigneeId !== null) {
      const assigneeMember = await prisma.projectMember.findUnique({
        where: {
          userId_projectId: { userId: req.body.assigneeId, projectId: task.projectId },
        },
      });
      if (!assigneeMember) {
        return res.status(400).json({ error: 'Assignee must be a project member' });
      }
    }

    const data = {};
    if (req.body.title !== undefined) data.title = req.body.title;
    if (req.body.description !== undefined) data.description = req.body.description || null;
    if (req.body.dueDate !== undefined) data.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
    if (req.body.priority !== undefined) data.priority = req.body.priority;
    if (req.body.status !== undefined) data.status = req.body.status;
    if (req.body.assigneeId !== undefined) data.assigneeId = req.body.assigneeId;

    const updated = await prisma.task.update({
      where: { id: task.id },
      data,
      include: taskInclude,
    });

    res.json({ task: formatTask(updated) });
  }
);

router.delete(
  '/:taskId',
  [param('taskId').notEmpty()],
  handleValidation,
  async (req, res) => {
    const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const membership = await getProjectMembership(task.projectId, req.userId);
    if (!requireAdmin(membership)) {
      return res.status(403).json({ error: 'Only admins can delete tasks' });
    }

    await prisma.task.delete({ where: { id: task.id } });
    res.json({ message: 'Task deleted' });
  }
);

export default router;
