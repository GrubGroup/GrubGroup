// Routes for /restaurants — browse/detail, create (with embedding), like/unlike.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  listRestaurants,
  getRestaurant,
  createRestaurant,
  likeRestaurant,
  unlikeRestaurant,
} from '../controllers/restaurants.controller.js';

const router = Router();

// Every restaurant route is caller-scoped and requires a valid session.
router.use(requireAuth);

router.get('/', listRestaurants);
router.post('/', createRestaurant);
router.get('/:restaurant_id', getRestaurant);

router.post('/:restaurant_id/like', likeRestaurant);
router.delete('/:restaurant_id/like', unlikeRestaurant);

export default router;
