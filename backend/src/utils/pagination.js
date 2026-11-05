const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

exports.paginate = (query = {}) => {
  const limit = Math.min(100, parsePositiveInteger(query.limit, 20));
  const requestedPage = parsePositiveInteger(query.page, 1);
  const maxPage = Math.floor(Number.MAX_SAFE_INTEGER / limit) + 1;
  const page = Math.min(requestedPage, maxPage);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};
