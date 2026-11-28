import { Hono } from 'hono';
import { ok } from '../lib/response';
import { adminRoutes } from './admin';
import { aiRoutes } from './ai';
import { meRoutes } from './me';
import { metaRoutes } from './meta';
import { toolRoutes } from './tools';
import { paymentRoutes } from './payments';
import { translateRoutes } from './translate';
import type { AppContext } from '../types/context';

export const apiRoutes = new Hono<AppContext>();

apiRoutes.get('/', (c) =>
  ok(c, {
    apiVersion: 'v1',
    endpoints: [
      'GET /api/v1/meta',
      'GET /api/v1/tools',
      'GET /api/v1/ai/status',
      'GET /api/v1/me',
      'GET /api/v1/admin (admin only)',
    ],
  }),
);

apiRoutes.route('/meta', metaRoutes);
apiRoutes.route('/tools', toolRoutes);
apiRoutes.route('/ai', aiRoutes);
apiRoutes.route('/me', meRoutes);
apiRoutes.route('/payments', paymentRoutes);
apiRoutes.route('/translate', translateRoutes);
apiRoutes.route('/admin', adminRoutes);
