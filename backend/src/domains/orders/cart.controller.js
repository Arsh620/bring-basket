const cartService = require('./cart.service');
const { success } = require('../../utils/response');

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};

exports.list = run(async (req, res) => {
  success(res, await cartService.list(req.cartActor, req.get('moduleId')));
});

exports.add = run(async (req, res) => {
  success(res, await cartService.add(req.cartActor, req.get('moduleId'), req.body), 'Added to cart', 201);
});

exports.update = run(async (req, res) => {
  success(res, await cartService.update(req.cartActor, req.get('moduleId'), req.body));
});

exports.removeItem = run(async (req, res) => {
  success(res, await cartService.removeItem(req.cartActor, req.get('moduleId'), req.body.cart_id ?? req.query.cart_id));
});

exports.clear = run(async (req, res) => {
  success(res, await cartService.clear(req.cartActor, req.get('moduleId')));
});

exports.mergeGuest = run(async (req, res) => {
  success(
    res,
    await cartService.mergeGuest(req.cartActor, req.get('moduleId'), req.body.guest_id),
    'Guest cart merged',
  );
});
