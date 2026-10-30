// Shared by the customer, seller and admin return controllers.
const { ReturnError } = require('../services/returns');
const { readFile } = require('../services/storage');

// Maps the service's ReturnError to its HTTP status. Anything else is a real
// server fault and goes to server.js's error handler unchanged.
function withReturnErrors(handler) {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (err) {
      if (err instanceof ReturnError) return res.status(err.statusCode).json({ message: err.message });
      throw err;
    }
  };
}

// Photos are only ever read through an authorised route (never a static
// folder), and the path always comes from the ReturnRequest document the
// caller has already been scoped to.
function sendReturnPhoto(res, returnRequest, rawIndex) {
  const index = Number(rawIndex);
  const photo = Number.isInteger(index) ? returnRequest.photos[index] : null;
  if (!photo) return res.status(404).json({ message: 'Photo not found' });
  res.set('Content-Type', 'image/jpeg');
  res.set('Cache-Control', 'private, no-store');
  return res.send(readFile(photo.path));
}

module.exports = { withReturnErrors, sendReturnPhoto };
