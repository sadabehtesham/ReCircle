module.exports = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message;
  if (err.name === 'ZodError') {
    status = 400;
    message = err.issues.map((i) => i.message).join(', ');
  } else if (err.name === 'ValidationError' || err.name === 'CastError') {
    status = 400;
  } else if (err.code === 11000) {
    status = 409;
    message = `${Object.keys(err.keyValue)[0]} already in use`;
  }
  if (status === 500) {
    console.error(err);
    message = 'Server error';
  }
  res.status(status).json({ success: false, message });
};
