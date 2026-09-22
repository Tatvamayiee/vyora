export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  const message = err.expose || err.status && err.message ? err.message : 'Something went wrong. Please try again.';
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
