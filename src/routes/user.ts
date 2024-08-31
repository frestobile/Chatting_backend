import express from 'express'
import { protect } from '../middleware/protect'
import { updateUser } from '../controllers/user'
import multer from 'multer'
const upload = multer({ dest: 'static/avatar/' })

const router = express.Router()

router.put('/', protect, upload.single('file'), updateUser)

export default router
