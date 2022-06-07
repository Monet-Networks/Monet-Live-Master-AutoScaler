const paginate = async (page, limit, model, filter = {}, projection = {}, sort = {}) => {
  page = Math.abs(parseInt(page));
  limit = Math.abs(parseInt(limit));
  if (page < 1) {
    page = 1;
  }
  if (limit < 1) {
    limit = 1;
  }
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const totalRecords = await model.countDocuments(filter);
  const result = {
    totalPage: Math.ceil(totalRecords / limit),
    totalRecords,
    limit,
    previousPage: startIndex > 0 ? page - 1 : false,
    currentPage: page,
    nextPage: endIndex < totalRecords ? page + 1 : false,
  };

  try {
    result.results = await model.find(filter, projection).sort(sort).limit(limit).skip(startIndex).exec();
    if (!result.results.length) {
      return null;
    }
    return result;
  } catch (e) {
    return null;
  }
};

module.exports = paginate;
