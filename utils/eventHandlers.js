class ErrorHandler {
  constructor(res, error) {
    this.error = error || 'Not Found';
    this.sendError(res);
  }

  sendError = (res) => {
    res.send({
      code: 400,
      error: true,
      response: this.error,
    });
  };
}

module.exports.ErrorHandler = ErrorHandler;
