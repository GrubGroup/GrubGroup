// Routes for /auth — register/login/google (mint JWT).
import { Router } from 'express'
import * as authController from '../controllers/auth.controller.js'

const router = Router()

router.post('/register', authController.register)
router.post('/login', authController.login)
router.post('/google', authController.google)

export default router
