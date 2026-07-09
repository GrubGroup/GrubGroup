// Centralized Express error handler.
//
// AuthError (and anything with a numeric `status`) maps to that status with its
// message; everything else is a 500 with a generic message (details logged).

// eslint-disable-next-line no-unused-vars -- Express requires the 4-arg signature.
export function errorMiddleware(err, req, res, next) {
  const status = Number.isInteger(err?.status) ? err.status : 500
  if (status >= 500) {
    console.error(err)
  }
  res.status(status).json({
    error: status >= 500 ? 'Internal server error.' : err.message,
  })
}
