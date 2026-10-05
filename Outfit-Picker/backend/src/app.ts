import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import cors from 'cors';
import { config } from './config/env';
import clothingRoutes from './routes/clothing';
import outfitRoutes from './routes/outfits';
import imageRoutes from './routes/images';
import { uploadsDirectory } from './services/imageStorage';

const app = express();

app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(uploadsDirectory));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'Outfit Picker backend is running.' });
});

app.use('/api/clothing', clothingRoutes);
app.use('/api/outfits', outfitRoutes);
app.use('/api/images', imageRoutes);

app.use((_req, res) => res.status(404).json({ message: 'Route not found.' }));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if ('type' in err && err.type === 'entity.parse.failed')
    return res
      .status(400)
      .json({ message: 'Request body must be valid JSON.' });
  if ('type' in err && err.type === 'entity.too.large')
    return res.status(413).json({ message: 'Request body is too large.' });
  if (process.env.NODE_ENV !== 'test') console.error(err);
  if (err.name === 'ImageServiceError') {
    const statusCode =
      'statusCode' in err && typeof err.statusCode === 'number'
        ? err.statusCode
        : 502;
    return res.status(statusCode).json({ message: err.message });
  }
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

export default app;
