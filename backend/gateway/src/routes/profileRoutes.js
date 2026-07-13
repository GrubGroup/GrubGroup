// Routes for /profile — read, create, and update the caller's preference profile.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  getProfile,
  createProfile,
  updateProfile,
} from '../controllers/profileController.js';

const router = Router();

// Every profile route is caller-scoped and requires a valid session.
router.use(requireAuth);

router.get('/', getProfile);
router.post('/', createProfile);
router.put('/', updateProfile);

export default router;
