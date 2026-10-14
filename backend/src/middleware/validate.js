module.exports = (schema, source = 'body') => (req, res, next) => {
  const data = schema.parse(req[source] ?? {});
  if (source === 'body') req.body = data;
  else req.valid = data;
  next();
};
