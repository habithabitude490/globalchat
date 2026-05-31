const path = require('path');
const fs = require('fs');

exports.uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }

        const fileUrl = `/uploads/images/${req.file.filename}`;
        res.json({
            url: fileUrl,
            filename: req.file.filename,
            size: req.file.size,
            message: 'Image uploaded successfully'
        });
    } catch (error) {
        console.error('[Upload] Image error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
};

exports.uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileUrl = `/uploads/files/${req.file.filename}`;
        res.json({
            url: fileUrl,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            message: 'File uploaded successfully'
        });
    } catch (error) {
        console.error('[Upload] File error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
};

exports.deleteUpload = async (req, res) => {
    try {
        const { type, filename } = req.params;

        const allowedTypes = ['avatars', 'images', 'files'];
        if (!allowedTypes.includes(type)) {
            return res.status(400).json({ error: 'Invalid upload type' });
        }

        const filePath = path.join(__dirname, '..', '..', 'uploads', type, filename);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.json({ message: 'File deleted' });
    } catch (error) {
        console.error('[Upload] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
};
