import { Request, Response, NextFunction } from 'express'
import Channel from '../models/channel'
import Organisation from '../models/organisation'
import Conversations from '../models/conversation'
import successResponse from '../helpers/successResponse'

import mongoose from 'mongoose';

// @desc    create channel
// @route   POST /api/v1/channel/create
// @access  Private
export async function createChannel(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { name, organisationId, isPublic } = req.body
    const organisation = await Organisation.findById(organisationId)
    const channel = await Channel.create({
      name,
      isPublic,
      collaborators: organisation.coWorkers,
      organisation: organisationId,
    })
    successResponse(res, channel)
  } catch (error) {
    next(error)
  }
}

export async function getChannels(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = req.params.id
    const channels = await Channel.find({ organisation: id })
      .populate({
        path: 'organisation',
        populate: [{ path: 'owner' }, { path: 'coWorkers' }],
      })
      .populate('collaborators')
      .sort({ _id: -1 })

    successResponse(res, channels)
  } catch (error) {
    next(error)
  }
}

export async function getChannel(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = req.params.id
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    const channel = await getChannelById(id);
    const conversation = await Conversations.findById(id)
      .populate('collaborators')
      .sort({ _id: -1 })

    if (!channel && !conversation) {
      return res.status(400).json({
        name: '見つかりません',
      })
    }
    if(channel) {
      const updatedChannel = {
        ...channel.toObject(),
        isChannel: true,
      }
  
      successResponse(res, updatedChannel)
    }
  } catch (error) {
    next(error)
  }
}

async function getChannelById(id: string) {
  const isExistOrg = await Organisation.findById(id)
  if (isExistOrg) {
    return await Channel.findOne({organisation : id})
      .populate('collaborators')
      .sort({ _id: 1 })
  } else {
    return await Channel.findById(id)
      .populate('collaborators')
      .sort({ _id: -1 })
  }
}

export async function updateChannel(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = req.params.id
    const channel = await Channel.findById(id)
    if (!channel) {
      return res.status(400).json({
        name: '見つかりません',
      })
    }

    const updatedChannel = await Channel.findByIdAndUpdate(
      id,
      { $addToSet: { collaborators: req.body.userId } },
      {
        new: true,
      }
    )

    successResponse(res, updatedChannel)
  } catch (error) {
    next(error)
  }
}
