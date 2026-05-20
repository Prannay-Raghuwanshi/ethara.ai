import { Router } from 'express';
import { param } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { authenticate, getProjectMembership } from '../middleware/auth.js';
import { handleValidation } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

router.get(
  '/project/:projectId',
  [param('projectId').notEmpty()],
  handleValidation,
  async (req, res) => {
    const membership = await getProjectMembership(req.params.projectId, req.userId);
    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this project' });
    }

    const projectId = req.params.projectId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    const byStatus = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
    const byUser = {};
    let overdue = 0;

    for (const task of tasks) {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;

      if (task.dueDate && task.status !== 'DONE' && new Date(task.dueDate) < today) {
        overdue += 1;
      }

      const key = task.assignee?.id || 'unassigned';
      const label = task.assignee?.name || 'Unassigned';
      if (!byUser[key]) {
        byUser[key] = { userId: task.assignee?.id || null, name: label, count: 0 };
      }
      byUser[key].count += 1;
    }

    res.json({
      dashboard: {
        totalTasks: tasks.length,
        byStatus,
        byUser: Object.values(byUser),
        overdueTasks: overdue,
      },
    });
  }
);

export default router;
