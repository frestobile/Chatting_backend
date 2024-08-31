import { Request, Response, NextFunction } from 'express'

import User, { UserSchemaType } from '../models/user'
import Organisation from '../models/organisation'

type UpdateUser = {
  username: string
  displayName: string
  avatar?: string
}

// @desc    get user
// @route   PUT /api/v1/user
// @access  Private
export async function updateUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { username, displayName, organisationId } = req.body
    const file = req.file
    const { id } = req.user

    const org = await Organisation.findById(organisationId).populate('coWorkers')

    if (org.coWorkers.find((cw: UserSchemaType) => cw._id.toString() !== id && (cw.displayName === displayName || cw.username === username)))
      throw new Error('Name is duplicated')

    const updateData: UpdateUser = {
      username,
      displayName
    }
    
    if (file && file.filename)
      updateData.avatar = file.filename

    const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true })
    res.json(updatedUser)
  } catch (error) {
    next(error)
  }
}