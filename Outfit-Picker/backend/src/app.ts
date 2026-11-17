import path from 'node:path';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { config } from './config/env';
import clothingRoutes from './routes/clothing';
import outfitRoutes from './routes/outfits';
import imageRoutes from './routes/images';
import { loadImage, localImagePattern } from './services/imageStorage';
import { demoResetMiddleware, demoStatus } from './services/demo';

const app = express();

if (config.trustProxy) app.set('trust proxy', config.trustProxy);
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    message: 'Outfit Picker backend is running.',
    demo: demoStatus(),
  });
});

if (config.writeRateLimit > 0)
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: config.writeRateLimit,
      skip: (req) => req.method === 'GET' || req.method === 'HEAD',
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        message: 'Too many changes in a short time. Try again in a few minutes.',
      },
    }),
  );
app.use(['/api', '/uploads'], demoResetMiddleware);

app.use('/api/clothing', clothingRoutes);
app.use('/api/outfits', outfitRoutes);
app.use('/api/images', imageRoutes);
app.use('/api', (_req, res) =>
  res.status(404).json({ message: 'Route not found.' }),
);

app.get('/uploads/:filename', async (req, res, next) => {
  const imageUrl = `/uploads/${req.params.filename}`;
  if (!localImagePattern.test(imageUrl))
    return res.status(404).json({ message: 'Photo not found.' });
  try {
    const image = await loadImage(imageUrl);
    if (!image) return res.status(404).json({ message: 'Photo not found.' });
    // A stored photo never changes; replacing one creates a new id.
    res
      .type('png')
      .set('Cache-Control', 'public, max-age=31536000, immutable')
      .send(image);
  } catch (error) {
    next(error);
  }
});

if (config.staticDirectory) {
  const staticDirectory = path.resolve(config.staticDirectory);
  app.use(express.static(staticDirectory, { index: false }));
  // Every other GET is the single-page app.
  app.get(/^\/(?!uploads\/).*/, (_req, res) =>
    res.sendFile(path.join(staticDirectory, 'index.html')),
  );
}

app.use((_req, res) => res.status(404).json({ message: 'Route not found.' }));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if ('type' in err && err.type === 'entity.parse.failed')
    return res
      .status(400)
      .json({ message: 'Request body must be valid JSON.' });
  if ('type' in err && err.type === 'entity.too.large')
    return res.status(413).json({ message: 'Request body is too large.' });
  if (process.env.NODE_ENV !== 'test') console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

export default app;
