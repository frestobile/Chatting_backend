import { Request, Response, NextFunction } from 'express'
import Conversations from '../models/conversation'
import Channel from '../models/channel'
import successResponse from '../helpers/successResponse'
import { UserSchemaType } from 'src/models/user'
import mongoose from 'mongoose'

export async function getConversations(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.body
    const conversations = await Conversations.find({ organisation: id }).sort({
      _id: -1,
    }).populate('collaborators')
    successResponse(res, conversations)
  } catch (error) {
    next(error)
  }
}

export async function getConversation(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = req.params.id
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }
    const conversation = await Conversations.findById(id)
      .populate('collaborators')
      .sort({ _id: -1 })

    const channel = await Channel.findById(id)
    .populate('collaborators')
    .sort({ _id: -1 })

    if (!conversation && !channel) {
      return res.status(400).json({
        name: '見つかりません',
      })
    }

    // const conversations = await Conversations.findById(id).populate(
    //   'collaborators'
    // )
    if (conversation) {
      const collaborators = [...conversation.collaborators]
      // 現在のユーザーの ID を持つコラボレーターのインデックスを検索します
      const currentUserIndex = conversation.collaborators.findIndex(
        (coworker: UserSchemaType) => coworker._id.toString() === req.user.id
      )
  
      // 現在のユーザーのコラボレーターを配列から削除します
      conversation.collaborators.splice(currentUserIndex, 1)
  
      // 他のコラボレーターのユーザー名に基づいて名前フィールドを作成します
      const name = conversation.collaborators[0]?.username || conversation.name
  
      successResponse(res, {
        ...conversation.toObject(),
        name,
        collaborators,
      })
    }
  } catch (error) {
    next(error)
  }
}
