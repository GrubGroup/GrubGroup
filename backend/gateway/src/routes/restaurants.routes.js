// Routes for /restaurants — create (with synchronous embedding) etc.
import { Router } from 'express';
import { createRestaurant } from '../controllers/restaurants.controller.js';

const router = Router();

router.post('/', createRestaurant);

export default router;
