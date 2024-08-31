import express from 'express'
import { protect } from '../middleware/protect'
import { getMessage, getMessages, getOg, deleteMessage, uploadImage, handleImageUpload, handleFileUpload, downloadFile } from '../controllers/message'
import multer from 'multer'
import path from 'path'

function formatDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}${hours}${minutes}_${seconds}`;
}

function sanitizeFilename(filename) {
  // Remove non-ASCII characters and replace invalid characters
  return filename.replace(/[^\x00-\x7F]/g, '').replace(/[\/\?<>\\:\*\|":]/g, '-');
}
var storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, 'static/image/');
  },
  filename: function (req, file, cb) {
    const originalName = path.parse(file.originalname).name; // Get the original file name without extension
    const sanitizedOriginalName = sanitizeFilename(originalName); // Sanitize the filename
    const extension = path.extname(file.originalname); // Get the file extension
    const formattedDate = formatDate(); // Get the formatted date and time
    const newName = `${sanitizedOriginalName}_${formattedDate}${extension}`; // Combine them
    cb(null, newName);
  }
});
var fileStorage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, 'static/file/');
  },
  filename: function (req, file, cb) {
    const originalName = path.parse(file.originalname).name; // Get the original file name without extension
    const sanitizedOriginalName = sanitizeFilename(originalName); // Sanitize the filename
    const extension = path.extname(file.originalname); // Get the file extension
    const formattedDate = formatDate(); // Get the formatted date and time
    const newName = `${sanitizedOriginalName}_${formattedDate}${extension}`; // Combine them
    cb(null, newName);
  }
});
const upload = multer({ storage })
const fileUpload = multer({ storage: fileStorage })
const router = express.Router()

router.get('/', protect, getMessages)
router.get('/:id', protect, getMessage)
router.get('/og/:uri', getOg)
router.delete('/:id', protect, deleteMessage)
router.post('/image', protect, upload.single('image'), uploadImage)
router.post('/image-upload', protect, upload.single('image'), handleImageUpload)
router.post('/file-upload', protect, fileUpload.single('file'), handleFileUpload)
router.get('/download/:file', downloadFile)

export default router
