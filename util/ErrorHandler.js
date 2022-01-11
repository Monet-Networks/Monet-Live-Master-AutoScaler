class ErrorHandler {
  constructor(res, code, message, error = null) {
    this.res = res;
    this.message = message;
    this.code = code ? code : 404;
    this.error = error ? error : 'There is something missing in the provided parameters.';
    this.sendError();
  }

  sendError = () => {
    return this.message
      ? this.res.json({
          code: this.code,
          error: true,
          message: this.message,
          response: this.error,
        })
      : this.res.json({
          code: this.code,
          error: true,
          response: this.error,
        });
  };
}

module.exports = ErrorHandler;
