import { Hono } from 'hono';
import { ok } from '../lib/response';
import { meRoutes } from './me';
import { metaRoutes } from './meta';
import { toolRoutes } from './tools';
import type { AppContext } from '../types/context';

export const apiRoutes = new Hono<AppContext>();

apiRoutes.get('/', (c) =>
  ok(c, {
    apiVersion: 'v1',
    endpoints: ['GET /api/v1/meta', 'GET /api/v1/tools', 'GET /api/v1/me'],
  }),
);

apiRoutes.route('/meta', metaRoutes);
apiRoutes.route('/tools', toolRoutes);
apiRoutes.route('/me', meRoutes);
