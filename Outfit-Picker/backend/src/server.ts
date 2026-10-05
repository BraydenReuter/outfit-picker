import app from './app';
import { config } from './config/env';

app.listen(config.port, config.host, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});
