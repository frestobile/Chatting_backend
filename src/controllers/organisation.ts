import { Request, Response, NextFunction } from 'express'
import Organisation, { OrganisationSchemaType } from '../models/organisation'
import Channel from '../models/channel'
import Message from '../models/message'
import Conversations from '../models/conversation'
import successResponse from '../helpers/successResponse'
import _User, { UserSchemaType } from 'src/models/user'
import mongoose from 'mongoose'

// @desc    get organisation
// @route   GET /api/v1/organisation/:id
// @access  Private
export async function getOrganisation(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = req.params.id
    var isValid = mongoose.Types.ObjectId.isValid(id)
    if (isValid) {
      let organisation = await Organisation.findById(id).populate([
        'coWorkers',
        'owner',
      ])

      if (!organisation) {
        return res.status(400, {
          name: 'no organisation found',
        })
      }

      const channels = await Channel.find({
        organisation: id,
      }).populate('collaborators')

      const updatedChannels = await Promise.all( 
        channels.map(async (channel) => {
          const messages = await Message.find({
            channel: channel._id,
          })
          const unreadMessages = messages.filter(
            (message) => message.unreadmember.includes(req.user.id)
          )
          return {
            ...channel.toObject(),
            unreadMessagesNumber: unreadMessages.length,
          }
        }
      ))

      const conversations = await Conversations.find({
        organisation: id,
      }).populate('collaborators')

      const conversationsWithCurrentUser = conversations.filter(
        (conversation) =>
          conversation.collaborators.some(
            (collaborator: UserSchemaType) =>
              collaborator._id.toString() === req.user.id
          )
      )

      const updatedConversations = await Promise.all( 
        conversationsWithCurrentUser.map(async (convo) => {
        // Find the index of the collaborator with the current user's ID
          const currentUserIndex = convo.collaborators.findIndex(
            (coworker: UserSchemaType) => coworker._id.toString() === req.user.id
          )
          const collaborators = [...convo.collaborators]

          // Remove the current user collaborator from the array
          const selfUser = convo.collaborators.splice(currentUserIndex, 1) as unknown as UserSchemaType[]
          // Create the name field based on the other collaborator's username
          const name = convo.collaborators[0]?.displayName ?? convo.collaborators[0]?.username ?? selfUser[0]?.displayName ?? selfUser[0]?.username
          const avatar = !convo.collaborators.length ? selfUser[0]?.avatar : convo.collaborators[0]?.avatar

          const messages = await Message.find({
            conversation: convo._id,
          })
          const unreadMessages = messages.filter(
            (message) => message.unreadmember.includes(req.user.id)
          )
          return {
            ...convo.toObject(),
            name,
            avatar,
            createdBy: convo.collaborators[0]?._id,
            collaborators,
            unreadMessagesNumber: unreadMessages.length,
          }
        })
      )

      // Check if the authenticated user is a co-worker of the organisation
      const currentUserIsCoWorker = organisation.coWorkers.some(
        (coworker: UserSchemaType) => coworker._id.toString() === req.user.id
      )

      // Replace the profile object with the corresponding co-worker's values
      let profile: UserSchemaType
      if (currentUserIsCoWorker) {
        const currentUser = organisation.coWorkers.find(
          (coworker: UserSchemaType) => coworker._id.toString() === req.user.id
        )
        profile = currentUser
      }

      // Update the coWorkers array in the organisation object
      const updatedOrganisation = {
        ...organisation.toObject(),
        conversations: updatedConversations,
        channels: updatedChannels,
        profile,
      }

      successResponse(res, updatedOrganisation)
    }
  } catch (error) {
    next(error)
  }
}

// @desc    get organisation
// @route   POST /api/v1/organisation
// @access  Private
export async function createOrganisation(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { name, id } = req.body

    if (!name && !id) {
      const organisation = await Organisation.create({
        owner: req.user.id,
        coWorkers: [req.user.id],
      })
      await Channel.create({
        organisation: organisation._id,
        name: 'General'
      })
      successResponse(res, organisation)
    }

    if (name && id) {
      const organisation = await Organisation.findOneAndUpdate(
        { _id: id },
        { $set: { name } },
        { new: true }
      ).populate(['coWorkers', 'owner'])

      organisation.generateJoinLink()
      await organisation.save()
      successResponse(res, organisation)
    }
  } catch (error) {
    next(error)
  }
}

export async function getWorkspaces(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = req.user.id
    // Find all organizations where the user is a co-worker
    const workspaces = await Organisation.find({ coWorkers: id })
    // Fetch channels for each organization
    const workspacesWithChannels = await Promise.all(
      workspaces.map(async (workspace) => {
        const channels = await Channel.find({ organisation: workspace._id })
        return {
          ...workspace.toObject(),
          channels,
        }
      })
    )

    successResponse(res, workspacesWithChannels)

    // successResponse(res, workspaces);
  } catch (error) {
    next(error)
  }
}

export async function addCoworker(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const organisationId = req.params.id
    const userID = req.user.id
    let organisation: OrganisationSchemaType
    const organisationExist = await Organisation.findById(organisationId)

    if (organisationExist) {
      try {
        // Check if existingUser is not part of coWorkers field before pushing
        const isUserAlreadyInCoWorkers =
          organisationExist.coWorkers.includes(userID)
          
        if (!isUserAlreadyInCoWorkers) {
          organisation = await Organisation.findOneAndUpdate(
            { _id: organisationId },
            {
              $addToSet: { coWorkers: userID },
            },
            { new: true }
          ).populate(['coWorkers', 'owner'])
        } else {
          organisation = await Organisation.findOne({ _id: organisationId }).populate(['coWorkers', 'owner'])
        }
      } catch (error) {
        next(error)
      }

      successResponse(res, organisation)

      // Create separate conversations for each unique pair of coWorkers
      for (let i = 0; i < organisation.coWorkers.length; i++) {
        for (let j = i + 1; j < organisation.coWorkers.length; j++) {
          // Check if a conversation with these collaborators already exists
          const existingConversation = await Conversations.findOne({
            collaborators: {
              $all: [
                organisation.coWorkers[i]._id,
                organisation.coWorkers[j]._id,
              ],
            },
            organisation: organisationId,
          })

          // If no conversation exists, create a new one
          if (!existingConversation) {
            await Conversations.create({
              name: `${organisation.coWorkers[i].username}, ${organisation.coWorkers[j].username}`,
              description: `This conversation is between ${organisation.coWorkers[i].username} and ${organisation.coWorkers[j].username}`,
              organisation: organisationId,
              isSelf:
                organisation.coWorkers[i]._id ===
                organisation.coWorkers[j]._id,
              collaborators: [
                organisation.coWorkers[i]._id,
                organisation.coWorkers[j]._id,
              ],
            })
          }
        }
      }

      // Create self-conversations for each coworker
      for (let i = 0; i < organisation.coWorkers.length; i++) {
        const selfConversationExists = await Conversations.findOne({
          collaborators: {
            $all: [organisation.coWorkers[i]._id],
          },
          organisation: organisationId,
          isSelf: true,
        })

        // If no self-conversation exists, create one
        if (!selfConversationExists) {
          await Conversations.create({
            name: `${organisation.coWorkers[i].username}`,
            description: `This is a conversation with oneself (${organisation.coWorkers[i].username}).`,
            organisation: organisationId,
            isSelf: true,
            collaborators: [organisation.coWorkers[i]._id],
          })
        }
      }
    }
  } catch (error) {
    next(error)
  }
}
