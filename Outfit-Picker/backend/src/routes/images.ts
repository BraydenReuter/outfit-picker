import { Router } from 'express';
import multer from 'multer';
import { config } from '../config/env';
import { prisma } from '../lib/prisma';
import {
  MAX_IMAGE_BYTES,
  ImageValidationError,
  saveProcessedImage,
  deleteProcessedImage,
  localImagePattern,
  cleanupUnusedImages,
} from '../services/imageStorage';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) =>
    callback(null, file.mimetype === 'image/png'),
});

// Background removal happens in the browser; this stores the finished PNG.
router.post('/', (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          message: `The processed photo exceeds the ${MAX_IMAGE_BYTES / 1024 / 1024} MB limit.`,
        });
      }
      return res.status(400).json({ message: 'Invalid image upload.' });
    }
    if (error) return next(error);
    if (!req.file)
      return res.status(400).json({ message: 'A PNG image file is required.' });

    const image = req.file.buffer;
    void (async () => {
      if ((await prisma.storedImage.count()) >= config.maxStoredImages) {
        // Abandoned previews are the usual cause; try to make room first.
        await cleanupUnusedImages();
        if ((await prisma.storedImage.count()) >= config.maxStoredImages)
          return res.status(403).json({
            message: 'Photo storage is full right now. Try again later.',
          });
      }
      const imageUrl = await saveProcessedImage(image);
      res.status(201).json({ imageUrl });
    })().catch((caught: unknown) => {
      if (caught instanceof ImageValidationError)
        return res.status(400).json({ message: caught.message });
      next(caught);
    });
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
