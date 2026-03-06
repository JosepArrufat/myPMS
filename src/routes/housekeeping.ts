import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import type { AuthenticatedRequest } from '../middleware/authenticate.js';
import {
  numericTaskParams,
  createTaskBody,
  updateTaskTypeBody,
  assignTaskBody,
  dailyBoardBody,
  taskRangeQuery,
  taskRoomParams,
  taskAssigneeParams,
  inspectParams,
} from '../schemas/housekeeping.js';

import {
  createTask,
  assignTask,
  startTask,
  completeTask,
  generateDailyTaskBoard,
  updateTaskType,
} from '../db/services/housekeeping.js';

import { inspectRoom } from '../db/services/inspection.js';

import {
  listTasksForDate,
  listTasksForRoom,
  listTasksForAssignee,
} from '../db/queries/housekeeping/housekeeping-tasks.js';

const router = Router();

// POST /api/housekeeping/tasks
router.post(
  '/tasks',
  authenticate,
  requireRole('admin', 'manager', 'housekeeping'),
  validate({ body: createTaskBody }),
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
  validate({ params: numericTaskParams, body: updateTaskTypeBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const { taskType } = req.body;
    const task = await updateTaskType(id, taskType, user.id);
    res.json({ task });
  }),
);

// POST /api/housekeeping/tasks/:id/assign
router.post(
  '/tasks/:id/assign',
  authenticate,
  requireRole('admin', 'manager', 'housekeeping'),
  validate({ params: numericTaskParams, body: assignTaskBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const { assigneeId } = req.body;
    const task = await assignTask(id, assigneeId, user.id);
    res.json({ task });
  }),
);

// POST /api/housekeeping/tasks/:id/start
router.post(
  '/tasks/:id/start',
  authenticate,
  requireRole('admin', 'manager', 'housekeeping'),
  validate({ params: numericTaskParams }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const task = await startTask(id, user.id);
    res.json({ task });
  }),
);

// POST /api/housekeeping/tasks/:id/complete
router.post(
  '/tasks/:id/complete',
  authenticate,
  requireRole('admin', 'manager', 'housekeeping'),
  validate({ params: numericTaskParams }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const task = await completeTask(id, user.id);
    res.json({ task });
  }),
);

// POST /api/housekeeping/daily-board
router.post(
  '/daily-board',
  authenticate,
  requireRole('admin', 'manager', 'housekeeping'),
  validate({ body: dailyBoardBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { taskDate } = req.body;
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
  validate({ params: taskRoomParams, query: taskRangeQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = req.query as unknown as { from: string; to: string };
    const tasks = await listTasksForRoom(Number(req.params.id), from, to);
    res.json({ tasks });
  }),
);

// GET /api/housekeeping/tasks/assignee/:id?from=&to=
router.get(
  '/tasks/assignee/:id',
  authenticate,
  validate({ params: taskAssigneeParams, query: taskRangeQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = req.query as unknown as { from: string; to: string };
    const tasks = await listTasksForAssignee(Number(req.params.id), from, to);
    res.json({ tasks });
  }),
);

// POST /api/housekeeping/inspect/:taskId
router.post(
  '/inspect/:taskId',
  authenticate,
  requireRole('admin', 'manager', 'housekeeping'),
  validate({ params: inspectParams }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const taskId = Number(req.params.taskId);
    const task = await inspectRoom(taskId, user.id);
    res.json({ task });
  }),
);

export default router;
