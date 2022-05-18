function sendSuccess(data, res) {
  res.json({
    code: 200,
    error: false,
    response: data,
  });
}

function sendError(message, res) {
  res.json({
    code: 404,
    error: true,
    response: { message },
  });
}

handleEngineData = (req, res, engine) => {
  if (!req.query.engine_secret) return sendError('no secret provided.');
  if (req.query.engine_secret !== 'monet-engine-615') return sendError('invalid secret', res);
  if (!engine) sendError('the engine is not defined.', res);
  sendSuccess(engine.State, res);
};

module.exports = { handleEngineData };
