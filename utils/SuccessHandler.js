class SuccessHandler {
  constructor(res, code, message, data = null) {
    this.code = code;
    this.message = message;
    this.data = data;
    this.res = res;
    this.handleSuccess();
  }

  handleSuccess = () => {
    return this.data
      ? this.res.json({
          code: this.code,
          error: false,
          message: this.message,
          data: this.data,
        })
      : this.res.json({
          code: this.code,
          error: false,
          message: this.message,
        });
  };
}


module.exports = SuccessHandler;