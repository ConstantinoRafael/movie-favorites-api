import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { Params } from 'nestjs-pino';

export const buildPinoParams = (): Params => ({
  pinoHttp: {
    autoLogging: false,
    genReqId: (req: IncomingMessage) => {
      const headerValue = req.headers['x-request-id'];
      const requestId = Array.isArray(headerValue)
        ? headerValue[0]
        : headerValue;

      return requestId ?? randomUUID();
    },
  },
});
