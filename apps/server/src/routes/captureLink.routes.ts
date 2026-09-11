import { Router } from 'express';
import { resolveCaptureCode } from '../services/captureCode.service.js';

export const captureLinkRouter = Router();

/**
 * What the QR code actually points at: a short one-time code that resolves
 * to a real token and redirects into the static capture page carrying it —
 * the phone never has to type or scan anything longer than this URL.
 */
captureLinkRouter.get('/:code', (req, res) => {
  const resolved = resolveCaptureCode(req.params.code);
  if (!resolved) {
    return res.status(410).send('انتهت صلاحية هذا الرابط — أعد عرض رمز QR من التطبيق');
  }
  res.redirect(`/capture/index.html?token=${resolved.token}&productId=${resolved.productId}`);
});
