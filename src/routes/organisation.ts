import express from 'express'
import { protect } from '../middleware/protect'
import {
  getOrganisation,
  createOrganisation,
  addCoworker,
  getWorkspaces,
} from '../controllers/organisation'

const router = express.Router()

router.get('/workspaces', protect, getWorkspaces)
router.get('/:id', protect, getOrganisation)
router.post('/', protect, createOrganisation)
router.post('/:id', protect, addCoworker)


export default router
