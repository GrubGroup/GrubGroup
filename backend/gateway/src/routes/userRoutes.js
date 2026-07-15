// Routes for /user — read and update the caller's own account identity.
import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getMe, updateMe } from '../controllers/userController.js';

const router = Router();

// Every user route is caller-scoped and requires a valid session.
router.use(requireAuth);

router.get('/me', getMe);
router.patch('/', updateMe);

export default router;
