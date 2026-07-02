const cloudinary = require("cloudinary").v2
const { CloudinaryStorage } = require("multer-storage-cloudinary")
const multer = require("multer")

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

// =============================================
// 1. STORAGE POUR LES PHOTOS DE PROFIL
// =============================================
const profileStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "socialapp/profils",
        allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
        transformation: [{ width: 400, height: 400, crop: "fill" }]
    }
})

// =============================================
// 2. STORAGE POUR LES POSTS
// =============================================
const postStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "socialapp/posts",
        allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
        transformation: [{ width: 1200, crop: "limit" }]
    }
})

// =============================================
// 3. STORAGE POUR LES PHOTOS DE GROUPE
// =============================================
const groupStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "socialapp/groupes",
        allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
        transformation: [{ width: 400, height: 400, crop: "fill" }]
    }
})

// =============================================
// 4. STORAGE POUR LES AUDIOS (messages vocaux)
// =============================================
const audioStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "socialapp/audios",
        resource_type: "video",
        allowed_formats: ["mp3", "webm", "ogg", "m4a", "aac"],
        format: "mp3",
        transformation: [
            {
                audio_bitrate: "32k",
                audio_frequency: 22050,
                quality: 50,
                fetch_format: "auto"
            }
        ],
        public_id: (req, file) => {
            const timestamp = Date.now();
            const random = Math.floor(Math.random() * 10000);
            return `audio_${timestamp}_${random}`;
        }
    }
})

// Storage pour les stories
const storyStorage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
        const isVideo = file.mimetype.startsWith("video/")
        return {
            folder: "socialapp/stories",
            resource_type: isVideo ? "video" : "image",
            allowed_formats: ["jpg", "jpeg", "png", "gif", "webp", "mp4", "mov", "webm", "m4v"],
            transformation: isVideo
                ? [{ width: 720, crop: "limit", duration: "60" }]
                : [{ width: 1080, crop: "limit" }]
        }
    }
})

const uploadStory = multer({
    storage: storyStorage,
    limits: { fileSize: 100 * 1024 * 1024 }
})

// =============================================
// 6. MULTER UPLOADS
// =============================================
const uploadProfile = multer({ 
    storage: profileStorage,
    limits: { fileSize: 2 * 1024 * 1024 }
})

const uploadPost = multer({ 
    storage: postStorage,
    limits: { fileSize: 5 * 1024 * 1024 }
})

const uploadGroup = multer({ 
    storage: groupStorage,
    limits: { fileSize: 2 * 1024 * 1024 }
})

const uploadAudio = multer({
    storage: audioStorage,
    limits: { fileSize: 1 * 1024 * 1024 }
})

// =============================================
// 8. EXPORT
// =============================================
module.exports = { 
    cloudinary, 
    uploadProfile, 
    uploadPost, 
    uploadGroup,
    uploadAudio,
    audioStorage,
    uploadStory  // ← NOUVEAU
}
