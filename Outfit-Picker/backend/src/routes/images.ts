import { Router } from 'express';
import multer from 'multer';
import { removeBackground } from '../services/imageService';
import {
  saveProcessedImage,
  deleteProcessedImage,
  localImagePattern,
} from '../services/imageStorage';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) =>
    callback(
      null,
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype),
    ),
});

router.post('/remove-background', (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res
          .status(413)
          .json({ message: 'Image exceeds the 10 MB upload limit.' });
      }
      return res.status(400).json({ message: 'Invalid image upload.' });
    }
    if (error) return next(error);
    if (!req.file)
      return res.status(400).json({ message: 'An image file is required.' });

    void removeBackground(req.file)
      .then(saveProcessedImage)
      .then((imageUrl) => res.status(201).json({ imageUrl }))
      .catch(next);
  });
});

router.delete('/:filename', async (req, res, next) => {
  const imageUrl = `/uploads/${req.params.filename}`;
  if (!localImagePattern.test(imageUrl))
    return res.status(400).json({ message: 'Invalid image path.' });
  try {
    await deleteProcessedImage(imageUrl);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
