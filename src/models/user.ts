import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import randomize from 'randomatic'

export interface UserSchemaType {
  _id: mongoose.Types.ObjectId
  username?: string
  displayName?: string
  avatar?: string
  email?: string
  role?: string
  phone?: string
  profilePicture?: string
  isOnline?: boolean
  loginVerificationCode?: string
  loginVerificationCodeExpires?: Date
  googleId?: string
  getSignedJwtToken?: () => string
  getVerificationCode?: () => string
}

const userSchema = new mongoose.Schema<UserSchemaType>(
  {
    username: {
      type: String,
      default() {
        return this.email.split('@')[0]
      },
    },
    email: {
      type: String,
      required: [true, 'あなたのメールアドレスを入力してください'],
      unique: true,
      // match: [/^\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,3}$/, '正しいメールアドレスを入力してください'],
    },
    displayName: {
      type: String,
      default() {
        return this.email.split('@')[0]
      },
    },
    avatar: String,
    googleId: String,
    isOnline: Boolean,
    role: String,
    phone: String,
    profilePicture: String,
    loginVerificationCode: String,
    loginVerificationCodeExpires: Date,
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

// Sign JWT and return
userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  })
}

// Generate login verification code
userSchema.methods.getVerificationCode = function () {
  const verificationCode = randomize('Aa0', 6)

  this.loginVerificationCode = crypto
    .createHash('sha256')
    .update(verificationCode)
    .digest('hex')
  this.loginVerificationCode = verificationCode
  this.loginVerificationCodeExpires = Date.now() + 24 * 60 * 60 * 1000 // 24 hours

  return verificationCode
}

export default mongoose.model('User', userSchema)
