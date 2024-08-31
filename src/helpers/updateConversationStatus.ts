import Conversations from '../models/conversation'
import User from '../models/user'

async function updateUserStatus(id, isOnline) {
  try {
    
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { isOnline },
      { new: true }
    )
    return updatedUser
  } catch (error) {
    console.error('Error updating user status:', error)
    throw error
  }
}

export default async function updateConversationStatus(id, isOnline) {
  try {
    await updateUserStatus(id, isOnline)

    
    const conversations = await Conversations.find({
      collaborators: { $in: id },
    }).populate('collaborators')

    
    for (const conversation of conversations) {
      let allCollaboratorsOnline = true

      for (const collaborator of conversation.collaborators) {
        const user = await User.findById(collaborator._id)
        if (!(user && user.isOnline)) {
          allCollaboratorsOnline = false
          break 
        }
      }

      if (allCollaboratorsOnline) {
        
        await Conversations.findByIdAndUpdate(
          conversation._id,
          { isOnline: true },
          { new: true }
        )
      } else {
        await Conversations.findByIdAndUpdate(
          conversation._id,
          { isOnline: false },
          { new: true }
        )
      }
    }
  } catch (error) {
    
    console.error('Error updating conversation status:', error)
    throw error
  }
}
