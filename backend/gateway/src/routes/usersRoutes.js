// Routes for /users — user lookup (username search for the member-picker).
// Every route requires a valid session.
import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { searchUsers } from '../controllers/usersController.js';

const router = Router();

router.use(requireAuth);

router.get('/search', searchUsers);

export default router;
