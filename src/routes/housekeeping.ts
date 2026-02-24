import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import type { AuthenticatedRequest } from '../middleware/authenticate.js';
import { BadRequestError } from '../errors.js';

// ─── Services ───────────────────────────────────────────────────────
import {
  createTask,
  assignTask,
  startTask,
  completeTask,
  generateDailyTaskBoard,
  updateTaskType,
} from '../db/services/housekeeping.js';

import { inspectRoom } from '../db/services/inspection.js';

// ─── Queries ────────────────────────────────────────────────────────
import {
  listTasksForDate,
  listTasksForRoom,
  listTasksForAssignee,
} from '../db/queries/housekeeping/housekeeping-tasks.js';

const router = Router();

// ═══════════════════════════════════════════════════════════════════
//  1.13  Housekeeping — /api/housekeeping
// ═══════════════════════════════════════════════════════════════════

// POST /api/housekeeping/tasks
router.post(
  '/tasks',
  authenticate,
  requireRole('admin', 'manager', 'housekeeping'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const task = await createTask(req.body, user.id);
    if ((task as any)._alreadyExists) {
      const { _alreadyExists, ...data } = task as any;
      return res.status(200).json({ task: data, warning: 'An identical open task already exists for this room and date' });
    }
    if ((task as any)._blocked) {
      const { _blocked, ...data } = task as any;
      return res.status(409).json({ existingTask: data, error: 'Another open task already exists for this room and date — complete or cancel it first' });
    }
    res.status(201).json({ task });
  }),
);

// PATCH /api/housekeeping/tasks/:id
router.patch(
  '/tasks/:id',
  authenticate,
  requireRole('admin', 'manager', 'housekeeping'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid task id');
    const { taskType } = req.body;
    if (!taskType) throw new BadRequestError('taskType is required');
    const task = await updateTaskType(id, taskType, user.id);
    res.json({ task });
  }),
);

// POST /api/housekeeping/tasks/:id/assign
router.post(
  '/tasks/:id/assign',
  authenticate,
  requireRole('admin', 'manager', 'housekeeping'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid task id');
    const { assigneeId } = req.body;
    if (!assigneeId) throw new BadRequestError('assigneeId is required');
    const task = await assignTask(id, assigneeId, user.id);
    res.json({ task });
  }),
);

// POST /api/housekeeping/tasks/:id/start
router.post(
  '/tasks/:id/start',
  authenticate,
  requireRole('admin', 'manager', 'housekeeping'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid task id');
    const task = await startTask(id, user.id);
    res.json({ task });
  }),
);

// POST /api/housekeeping/tasks/:id/complete
router.post(
  '/tasks/:id/complete',
  authenticate,
  requireRole('admin', 'manager', 'housekeeping'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid task id');
    const task = await completeTask(id, user.id);
    res.json({ task });
  }),
);

// POST /api/housekeeping/daily-board
router.post(
  '/daily-board',
  authenticate,
  requireRole('admin', 'manager', 'housekeeping'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { taskDate } = req.body;
    if (!taskDate) throw new BadRequestError('taskDate is required');
    const tasks = await generateDailyTaskBoard(taskDate, user.id);
    res.status(201).json({ tasks, count: tasks.length });
  }),
);

// GET /api/housekeeping/tasks/date/:date
router.get(
  '/tasks/date/:date',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const tasks = await listTasksForDate(req.params.date as string);
    res.json({ tasks });
  }),
);

// GET /api/housekeeping/tasks/room/:id?from=&to=
router.get(
  '/tasks/room/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) throw new BadRequestError('from and to query params are required');
    const tasks = await listTasksForRoom(Number(req.params.id), from, to);
    res.json({ tasks });
  }),
);

// GET /api/housekeeping/tasks/assignee/:id?from=&to=
router.get(
  '/tasks/assignee/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) throw new BadRequestError('from and to query params are required');
    const tasks = await listTasksForAssignee(Number(req.params.id), from, to);
    res.json({ tasks });
  }),
);

// POST /api/housekeeping/inspect/:taskId
router.post(
  '/inspect/:taskId',
  authenticate,
  requireRole('admin', 'manager', 'housekeeping'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const taskId = Number(req.params.taskId);
    if (isNaN(taskId)) throw new BadRequestError('Invalid task id');
    const task = await inspectRoom(taskId, user.id);
    res.json({ task });
  }),
);

export default router;
