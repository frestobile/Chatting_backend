import express from 'express'
import dotenv from 'dotenv'
import connectDB from './config/db'
dotenv.config()
import user from './routes/user'
import auth from './routes/auth'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
// import helmet from 'helmet'
// import xss from 'xss-clean'
import rateLimit from 'express-rate-limit'
import hpp from 'hpp'
import cors from 'cors'
import message from './routes/message'
import organisation from './routes/organisation'
import teammates from './routes/teammates'
import thread from './routes/thread'
import channel from './routes/channel'
import errorResponse from './middleware/errorResponse'
import Channels from '../src/models/channel'
import updateConversationStatus from './helpers/updateConversationStatus'
import Conversations from './models/conversation'
import conversations from './routes/conversations'
import { Server } from 'socket.io'
import http from 'http'
import Thread from './models/thread'
import Message from '../src/models/message'
import createTodaysFirstMessage from './helpers/createTodaysFirstMessage'
import passport from 'passport'
import cookieSession from 'cookie-session'
// import { parse } from 'html-metadata-parser'
import ogs from 'open-graph-scraper'
import axios from 'axios'
import mongoose from 'mongoose'

import { unlink } from 'fs';  
import { promisify } from 'util';

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST'],
  },
})

connectDB()

// Express 構成
app.use(
  cookieSession({
    name: 'session',
    keys: ['cyberwolve'],
    maxAge: 24 * 60 * 60 * 100,
  })
)

app.use(passport.initialize())
app.use(passport.session())

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
// cookie-parser 構成
app.use(cookieParser())

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'))
}

// Set security headers
// app.use(helmet())

// Prevent XSS attacks
// app.use(xss())

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: 1000,
})
app.use(limiter)

// Prevent http param pollution
app.use(hpp())

// Enable CORS
app.use(cors())

const users = {}

const messageContentUpdate = async (messageContent) => {
  function encodeSpacesInUrls(content) {
    const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%=~_|!:,.; ]*[-A-Z0-9+&@#\/%=~_|])/gi
    return content.replace(urlPattern, (url) => {
      return url.replace(/ /g, '%20')
    })
  }

  const encodedMessageContent = encodeSpacesInUrls(messageContent)
  const regEx =
    /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi
  const content = encodedMessageContent.match(regEx)
  const urls: string[] = []
  const contentLen = content?.length ?? 0
  let messageContentUpdated = messageContent

  async function isValidImageUrl(url) {
    try {
      const response = await axios.head(url)
      return response.headers['content-type'].startsWith('image/')
    } catch (error) {
      return false
    }
  }

  async function getOgInfo(url) {
    const options = { url }
    try {
      const { error, result } = await ogs(options)
      if (error) {
        console.error('Error fetching OG data:', error)
        return null
      }
      return result
    } catch (err) {
      console.error('Error:', err)
      return null
    }
  }

  if (contentLen > 0 && content) {
    for (let i = 0; i < contentLen; i++) {
      // const { origin } = new URL(content[i])
      const origin = content[i]
      const exist = urls.find((url) => url === origin)
      if (!exist) {
        urls.push(origin)
      }
    }

    let isImage = false

    for (const url of urls) {
      // const metadata = await parse(url)
      if (
        url.includes(process.env.API_URL + '/static/image/') ||
        url.includes(process.env.API_URL + '/messages/download/')
      )
        isImage = true
      if(isImage) break
      if(url.includes('/static/file')) {
        if(url.includes('.mp3')) {
          const audio = '<p><br></p><audio controls><source src="' + url + '" type="audio/mpeg"></audio>'
          messageContentUpdated = messageContentUpdated + audio
        } else if (url.includes('.mp4')) {
          const video = '<p><br></p><video controls class="entity-image"><source src="' + url + '" type="video/mp4"></video>'
          messageContentUpdated = messageContentUpdated + video
        }
      } else {
        try {
          const metadata = await getOgInfo(url)
          if (metadata.error) {
            // Handle error, log details or notify user
            console.error('Error fetching Open Graph info:')
          } else {
            // Proceed with using the metadata
            const siteName = metadata.ogSiteName || ''
            const title = metadata.ogTitle || metadata.twitterTitle || ''
            const description =
              metadata.ogDescription || metadata.twitterDescription || ''
            const image =
              metadata.ogImage?.[0].url ||
              metadata.twitterImage?.[0]?.url ||
              // metadata.favicon ||
              ''
            console.log('metadata=>', metadata)
            const isValidImage = image
              ? await isValidImageUrl(image)
              : false
            const ogElemString = ` <div className="sm:w-full w-1/2">
                <p class="font-bold">${siteName}</p>
                <p class="font-semibold text-blue-600">${title}</p>
                ${description ? `<p>${description}</p>` : ''}
                ${isValidImage ? `<img src="${image}" class="entity-image" />` : ``}
              </div>`
            messageContentUpdated = messageContentUpdated + ogElemString
          }
        } catch (err) {
          console.error('An error occurred:', err)
        }
      }
    }
  }
  return messageContentUpdated
}

const unlinkAsync = promisify(unlink)

async function deleteFile(filePath: string): Promise<void> {
  try {
    await unlinkAsync(filePath)
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error)
  }
}

function getFileNameFromUrl(url: string): string {
  const lastSlashIndex = url.lastIndexOf('/')

  if (lastSlashIndex === -1) {
    return ''
  }

  const fileName = url.substring(lastSlashIndex + 1)
  const decodeName = decodeURIComponent(fileName)
  return decodeName
}


const deleteFileFromMessageContent = (messageContent) => {
  function encodeSpacesInUrls(content) {
    const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%=~_|!:,.; ]*[-A-Z0-9+&@#\/%=~_|])/gi
    return content.replace(urlPattern, (url) => {
      return url.replace(/ /g, '%20')
    })
  }

  const encodedMessageContent = encodeSpacesInUrls(messageContent)
  const regEx =
    /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi
  const content = encodedMessageContent.match(regEx)
  const urls: string[] = []
  const contentLen = content?.length ?? 0

  if (contentLen > 0 && content) {
    for (let i = 0; i < contentLen; i++) {
      const exist = urls.find((url) => url === content[i])
      if (!exist) {
        urls.push(content[i])
      }
    }
  }

  for (const url of urls) {
    if(url.includes('/static/file')) {
      deleteFile('static/file/' + getFileNameFromUrl(url))
    } else if (url.includes('/static/image')) {
      deleteFile('static/image/' + getFileNameFromUrl(url))
    }
  }
}

io.on('connection', (socket) => {
  socket.on('user-join', async ({ id, isOnline }) => {
    socket.join(id)
    await updateConversationStatus(id, isOnline)
    io.emit('user-join', { id, isOnline })
  })

  socket.on('user-leave', async ({ id, isOnline }) => {
    socket.leave(id)
    await updateConversationStatus(id, isOnline)
    io.emit('user-leave', { id, isOnline })
  })

  socket.on('channel-open', async ({ id, userId }) => {
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      socket.join(id)
      const updatedChannel = await Channels.findByIdAndUpdate(
        id,
        { $pull: { hasNotOpen: userId } },
        { new: true }
      ).populate(['collaborators'])
      io.to(id).emit('channel-updated', updatedChannel)
    }
  })
  socket.on('convo-open', async ({ id, userId }) => {
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      socket.join(id)
      const updatedConversation = await Conversations.findByIdAndUpdate(
        id,
        { $pull: { hasNotOpen: userId } },
        { new: true }
      ).populate(['collaborators'])
      io.to(id).emit('convo-updated', updatedConversation)
    }
  })

  socket.on('thread-message', async ({ userId, messageId, message }) => {
    try {
      socket.join(messageId)
      let updatedContent = await messageContentUpdate(message.content)
      let newMessage = await Thread.create({
        sender: message.sender,
        content: updatedContent,
        message: messageId,
        hasRead: false,
      })
      newMessage = await newMessage.populate('sender')
      io.to(messageId).emit('thread-message', { newMessage })
      const updatedMessage = await Message.findByIdAndUpdate(
        messageId,
        {
          threadLastReplyDate: newMessage.createdAt,
          $addToSet: { threadReplies: userId },
          $inc: { threadRepliesCount: 1 },
        },
        { new: true }
      ).populate(['threadReplies', 'sender', 'reactions.reactedToBy'])

      io.to(messageId).emit('message-updated', {
        id: messageId,
        message: updatedMessage,
      })

      // socket.emit("message-updated", { messageId, message: updatedMessage });
    } catch (error) {
      console.log(error)
    }
  })

  socket.on(
    'message',
    async ({
      channelId,
      channelName,
      conversationId,
      collaborators,
      isSelf,
      isPublic,
      message,
      organisation,
      hasNotOpen,
    }) => {
      try {
        if (channelId) {
          socket.join(channelId)

          await createTodaysFirstMessage({ channelId, organisation })

          const createMessage = await Message.create({
            organisation,
            sender: message.sender,
            content: message.content,
            channel: channelId,
            hasRead: false,
          })

          const newMessage = await createMessage.populate('sender')

          // Add collaborators from the channel for unread members
          const channel = await Channels.findOne({ _id: channelId });
          const filteredCollaborators = channel.collaborators.filter(  
            (collaborator) => collaborator.toString() !== message.sender.toString()  
          );
          await Message.updateOne(  
            { _id: createMessage._id },  
            { $set: { unreadmember: filteredCollaborators } }  
          );

          io.to(channelId).emit('message', {
            newMessage,
            organisation,
            isPublic,
            channelId,
          })

          const updatedChannel = await Channels.findByIdAndUpdate(
            channelId,
            { hasNotOpen },
            { new: true }
          ).populate(['collaborators'])

          io.to(channelId).emit('channel-updated', updatedChannel)
          socket.broadcast.emit('notification', {
            channelName,
            channelId,
            collaborators,
            newMessage,
            organisation,
            isPublic,
          })

          let updatedContent = await messageContentUpdate(createMessage.content)
          await Message.findByIdAndUpdate(createMessage._id, {
            content: updatedContent,
          })
          io.to(channelId).emit('message-update', {
            _id: createMessage._id,
            updatedContent,
          })
          setTimeout(() => {}, 1000)
        } else if (conversationId) {
          socket.join(conversationId)
          // Check if there are any messages for today in the channel
          await createTodaysFirstMessage({ conversationId, organisation })
          let updatedContent = await messageContentUpdate(message.content)
          let newMessage = await Message.create({
            organisation,
            sender: message.sender,
            content: updatedContent,
            conversation: conversationId,
            collaborators,
            isSelf,
            hasRead: false,
          })
          newMessage = await newMessage.populate('sender')

          // Add collaborators from the channel for unread members
          const conversation = await Conversations.findOne({ _id: conversationId });
          const filteredCollaborators = conversation.collaborators.filter(
            (collaborator) => collaborator.toString() !== message.sender.toString()
          );
          await Message.updateOne(
            { _id: newMessage._id },
            { $set: { unreadmember: filteredCollaborators } }
          );

          io.to(conversationId).emit('message', {
            collaborators,
            organisation,
            newMessage,
            isPublic,
            channelId: conversationId,
          })
          const updatedConversation = await Conversations.findByIdAndUpdate(
            conversationId,
            { hasNotOpen },
            { new: true }
          ).populate(['collaborators'])
          io.to(conversationId).emit('convo-updated', updatedConversation)
          socket.broadcast.emit('notification', {
            collaborators,
            organisation,
            newMessage,
            isPublic,
            conversationId,
          })
        }
      } catch (error) {
        console.log(error)
      }
    }
  )

  socket.on('message-view', async (messageId, userId) => {
    if(messageId && mongoose.Types.ObjectId.isValid(messageId)){
      socket.join(messageId)
      const message = await Message.findByIdAndUpdate(
        messageId ,
        { $pull : { unreadmember: userId } }
      )
      if (message) {
        io.emit('message-viewed', message)
      } else {
        console.log('メッセージが見つかりません')
      }
    }
    
  })

  socket.on('message-delete', async ({ messageId, channelId, userId, isThread }) => {
    const existingMessage = await Message.findOne({
      _id: messageId,
      sender: userId,
    })
    if (existingMessage) {
      deleteFileFromMessageContent(existingMessage.content)
      await Message.findByIdAndDelete(messageId)
      io.to(channelId).emit('message-delete', { channelId, messageId, isThread })
    }else {
      const existingThread = await Thread.findOne({
        _id: messageId,
        sender: userId,
      })
      deleteFileFromMessageContent(existingThread.content)
      if(existingThread) {
        await Thread.findByIdAndDelete(messageId)
        await Message.updateOne(
          { _id: existingThread.message?.toString() },
          { $inc: { threadRepliesCount: -1 } } 
        )
        io.to(channelId).emit('message-delete', { channelId, messageId, isThread })
      }
    }
  })

  socket.on('reaction', async ({ emoji, id, isThread, userId }) => {
    // 1. Message.findbyid(id)
    let message
    if (isThread) {
      message = await Thread.findById(id)
    } else {
      message = await Message.findById(id)
    }

    if (!message) {
      // Handle the case where the model with the given id is not found
      return
    }
    // 2. check if emoji already exists in Message.reactions array
    if (message.reactions.some((r) => r.emoji === emoji)) {
      // 3. if it does, check if userId exists in reactedToBy array
      if (
        message.reactions.some(
          (r) =>
            r.emoji === emoji &&
            r.reactedToBy.some((v) => v.toString() === userId)
        )
      ) {
        // Find the reaction that matches the emoji and remove userId from its reactedToBy array
        const reactionToUpdate = message.reactions.find(
          (r) => r.emoji === emoji
        )
        if (reactionToUpdate) {
          reactionToUpdate.reactedToBy = reactionToUpdate.reactedToBy.filter(
            (v) => v.toString() !== userId
          )

          // If reactedToBy array is empty after removing userId, remove the reaction object
          if (reactionToUpdate.reactedToBy.length === 0) {
            message.reactions = message.reactions.filter(
              (r) => r !== reactionToUpdate
            )
          }
          // await message.populate([
          //   "reactions.reactedToBy",
          //   "sender",
          //   // "threadReplies",
          // ]);
          if (isThread) {
            await message.populate(['reactions.reactedToBy', 'sender'])
          } else {
            await message.populate([
              'reactions.reactedToBy',
              'sender',
              'threadReplies',
            ])
          }
          socket.emit('message-updated', { id, message, isThread })
          await message.save()
        }
      } else {
        // Find the reaction that matches the emoji and push userId to its reactedToBy array
        const reactionToUpdate = message.reactions.find(
          (r) => r.emoji === emoji
        )
        if (reactionToUpdate) {
          reactionToUpdate.reactedToBy.push(userId)
          // await message.populate([
          //   "reactions.reactedToBy",
          //   "sender",
          //   // isThread && "threadReplies",

          //   // "threadReplies",
          // ]);
          if (isThread) {
            await message.populate(['reactions.reactedToBy', 'sender'])
          } else {
            await message.populate([
              'reactions.reactedToBy',
              'sender',
              'threadReplies',
            ])
          }
          socket.emit('message-updated', { id, message, isThread })
          await message.save()
        }
      }
    } else {
      // 4. if it doesn't exists, create a new reaction like this {emoji, reactedToBy: [userId]}
      message.reactions.push({ emoji, reactedToBy: [userId] })
      // await message.populate([
      //   "reactions.reactedToBy",
      //   "sender",
      //   // isThread && "threadReplies",
      //   // "threadReplies",
      // ]);
      if (isThread) {
        await message.populate(['reactions.reactedToBy', 'sender'])
      } else {
        await message.populate([
          'reactions.reactedToBy',
          'sender',
          'threadReplies',
        ])
      }
      socket.emit('message-updated', { id, message, isThread })
      await message.save()
    }
  })
  // Event handler for joining a room
  socket.on('join-room', ({ roomId, userId }) => {
    // Join the specified room
    socket.join(roomId)
    // Store the user's socket by their user ID
    users[userId] = socket
    // Broadcast the "join-room" event to notify other users in the room
    socket.to(roomId).emit('join-room', { roomId, otherUserId: userId })

    console.log(`User ${userId} joined room ${roomId}`)
  })

  // Event handler for sending an SDP offer to another user
  socket.on('offer', ({ offer, targetUserId }) => {
    // Find the target user's socket by their user ID
    const targetSocket = users[targetUserId]
    if (targetSocket) {
      targetSocket.emit('offer', { offer, senderUserId: targetUserId })
    }
  })

  // Event handler for sending an SDP answer to another user
  socket.on('answer', ({ answer, senderUserId }) => {
    socket.broadcast.emit('answer', { answer, senderUserId })
  })

  // Event handler for sending ICE candidates to the appropriate user (the answerer)
  socket.on('ice-candidate', ({ candidate, senderUserId }) => {
    // Find the target user's socket by their user ID
    const targetSocket = users[senderUserId]
    if (targetSocket) {
      targetSocket.emit('ice-candidate', candidate, senderUserId)
    }
  })

  // Event handler for leaving a room
  socket.on('room-leave', ({ roomId, userId }) => {
    socket.leave(roomId)
    // Remove the user's socket from the users object
    delete users[userId]
    // Broadcast the "room-leave" event to notify other users in the room
    socket.to(roomId).emit('room-leave', { roomId, leftUserId: userId })
    console.log(`User ${userId} left room ${roomId}`)
  })
})

app.use('/api/v1/static', express.static('static'))
// Routes
app.use('/api/v1/auth', auth)
app.use('/api/v1/user', user)
app.use('/api/v1/channel', channel)
app.use('/api/v1/messages', message)
app.use('/api/v1/threads', thread)
app.use('/api/v1/teammates', teammates)
app.use('/api/v1/organisation', organisation)
app.use('/api/v1/conversations', conversations)

// error handler
app.use(errorResponse)

// Start the server
const port = process.env.PORT || 8000
server.listen(port, () => {
  console.log(`サーバーはポート ${port} で実行されています`)
})
