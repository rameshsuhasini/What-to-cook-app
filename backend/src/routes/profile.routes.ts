import { Router } from 'express'
import { body } from 'express-validator'
import multer from 'multer'
import path from 'path'
import profileController from '../controllers/profile.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'

const storage = multer.diskStorage({
  destination: path.join(process.cwd(), 'uploads', 'avatars'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only image files are allowed'))
  },
})

const router = Router()

// All profile routes require auth
router.use(authenticate)

router.get('/', profileController.getProfile.bind(profileController))
router.post('/avatar', upload.single('avatar'), profileController.uploadAvatar.bind(profileController))

router.put(
  '/',
  [
    body('age').custom(v => v == null || (Number.isInteger(Number(v)) && v >= 1 && v <= 120)).withMessage('Invalid age'),
    body('heightCm').custom(v => v == null || (Number.isInteger(Number(v)) && v >= 50 && v <= 300)).withMessage('Invalid height'),
    body('weightKg').custom(v => v == null || (isFinite(v) && v >= 20 && v <= 500)).withMessage('Invalid weight'),
    body('targetWeightKg').custom(v => v == null || (isFinite(v) && v >= 20 && v <= 500)).withMessage('Invalid target weight'),
    body('calorieGoal').custom(v => v == null || (Number.isInteger(Number(v)) && v >= 500 && v <= 10000)).withMessage('Invalid calorie goal'),
    body('proteinGoal').custom(v => v == null || (Number.isInteger(Number(v)) && v >= 0 && v <= 1000)).withMessage('Invalid protein goal'),
    body('carbGoal').custom(v => v == null || (Number.isInteger(Number(v)) && v >= 0 && v <= 1000)).withMessage('Invalid carb goal'),
    body('fatGoal').custom(v => v == null || (Number.isInteger(Number(v)) && v >= 0 && v <= 500)).withMessage('Invalid fat goal'),
  ],
  validate,
  profileController.updateProfile.bind(profileController)
)

export default router