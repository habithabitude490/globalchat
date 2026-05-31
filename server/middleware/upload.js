const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const AVATAR_DIR = path.join(__dirname, '..', '..', 'uploads', 'avatars');
const FILE_DIR = path.join(__dirname, '..', '..', 'uploads', 'files');
const IMAGE_DIR = path.join(__dirname, '..', '..', 'uploads', 'images');

const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, AVATAR_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `avatar_${req.userId}_${uuidv4()}${ext}`);
    }
});

const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, FILE_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `file_${req.userId}_${uuidv4()}${ext}`);
    }
});

const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, IMAGE_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `image_${req.userId}_${uuidv4()}${ext}`);
    }
});

const imageFilter = (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid image type. Allowed: jpg, jpeg, png, gif, webp'), false);
    }
};

const fileFilter = (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt', '.zip', '.rar', '.csv', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'), false);
    }
};

const MAX_SIZE = parseInt(process.env.UPLOAD_MAX_SIZE, 10) || 10485760;

const uploadAvatar = multer({
    storage: avatarStorage,
    fileFilter: imageFilter,
    limits: { fileSize: MAX_SIZE, files: 1 }
}).single('avatar');

const uploadFile = multer({
    storage: fileStorage,
    fileFilter,
    limits: { fileSize: MAX_SIZE, files: 1 }
}).single('file');

const uploadImage = multer({
    storage: imageStorage,
    fileFilter: imageFilter,
    limits: { fileSize: MAX_SIZE, files: 1 }
}).single('image');

function handleUploadError(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size exceeds limit (10MB)' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
}

module.exports = { uploadAvatar, uploadFile, uploadImage, handleUploadError };
