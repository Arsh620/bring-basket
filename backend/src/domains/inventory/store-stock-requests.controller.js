const { success, error } = require('../../utils/response');
const AppError = require('../../utils/AppError');
const {
  getAll,
  getById,
  createRequest,
  approveRequest,
  dispatchRequest,
  receiveRequest,
  rejectRequest,
} = require('./store-stock-requests.service');

exports.getAll = async (req, res, next) => {
  try {
    const result = await getAll(req.query);
    return res.json({
      success: true,
      data: result.requests,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const request = await getById(req.params.id);
    return success(res, request);
  } catch (err) {
    if (err instanceof AppError) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const request = await createRequest(req.body);
    return success(res, request, 'Request created', 201);
  } catch (err) {
    if (err instanceof AppError) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.approve = async (req, res, next) => {
  try {
    const request = await approveRequest(req.params.id);
    return success(res, request, 'Approved');
  } catch (err) {
    if (err instanceof AppError) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.dispatch = async (req, res, next) => {
  try {
    const request = await dispatchRequest(req.params.id, req.body.items, req.user);
    return success(res, request, 'Dispatched');
  } catch (err) {
    if (err instanceof AppError) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.receive = async (req, res, next) => {
  try {
    const request = await receiveRequest(req.params.id, req.body.items, req.body.grnNumber, req.body.grnPath);
    return success(res, request, 'Received');
  } catch (err) {
    if (err instanceof AppError) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.reject = async (req, res, next) => {
  try {
    const request = await rejectRequest(req.params.id, req.body.rejectReason);
    return success(res, request, 'Rejected');
  } catch (err) {
    if (err instanceof AppError) return error(res, err.message, err.statusCode);
    next(err);
  }
};
