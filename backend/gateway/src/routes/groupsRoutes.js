// Routes for /groups — groups, membership, chat history, and group-scoped
// sessions/events. Every route is caller-scoped and requires a valid session.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  listGroups,
  createGroup,
  getGroup,
  addMember,
  removeMember,
  listMessages,
  postMessage,
  listGroupSessions,
  listGroupEvents,
} from '../controllers/groupsController.js';

const router = Router();

router.use(requireAuth);

router.get('/', listGroups);
router.post('/', createGroup);
router.get('/:group_id', getGroup);

router.post('/:group_id/members', addMember);
router.delete('/:group_id/members/:user_id', removeMember);

router.get('/:group_id/messages', listMessages);
router.post('/:group_id/messages', postMessage);

router.get('/:group_id/sessions', listGroupSessions);
router.get('/:group_id/events', listGroupEvents);

export default router;
