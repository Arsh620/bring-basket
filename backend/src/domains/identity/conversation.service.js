const mongoose = require('mongoose');
const { Conversation, Message } = require('../../models/store/NotificationModels');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');

// ── Conversations ─────────────────────────────────────────────────────────────
const getConversations = async (actorId, actorType, query = {}) => {
  const { skip, page, limit } = paginate(query);
  const filter = { $or: [
    { senderId: actorId, senderType: actorType },
    { receiverId: actorId, receiverType: actorType },
  ]};

  if (query.search?.trim()) {
    // search by participant name — simplified: search by id
    if (mongoose.isValidObjectId(query.search.trim())) {
      filter.$or.push({ senderId: query.search.trim() }, { receiverId: query.search.trim() });
    }
  }

  const [conversations, total] = await Promise.all([
    Conversation.find(filter)
      .populate('lastMessageId', 'message createdAt senderType')
      .sort({ lastMessageTime: -1 }).skip(skip).limit(limit),
    Conversation.countDocuments(filter),
  ]);
  return { conversations, total, page, limit, pages: Math.ceil(total / limit) };
};

const getOrCreateConversation = async (senderId, senderType, receiverId, receiverType) => {
  let conv = await Conversation.findOne({
    $or: [
      { senderId, senderType, receiverId, receiverType },
      { senderId: receiverId, senderType: receiverType, receiverId: senderId, receiverType: senderType },
    ],
  });
  if (!conv) {
    conv = await Conversation.create({ senderId, senderType, receiverId, receiverType });
  }
  return conv;
};

// ── Messages ──────────────────────────────────────────────────────────────────
const getMessages = async (conversationId, actorId, actorType, query = {}) => {
  if (!mongoose.isValidObjectId(conversationId)) throw new AppError('Invalid conversationId', 400);

  const conv = await Conversation.findOne({
    _id: conversationId,
    $or: [
      { senderId: actorId, senderType: actorType },
      { receiverId: actorId, receiverType: actorType },
    ],
  });
  if (!conv) throw new AppError('Conversation not found', 404);

  const { skip, page, limit } = paginate({ ...query, limit: query.limit || 50 });
  const [messages, total] = await Promise.all([
    Message.find({ conversationId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Message.countDocuments({ conversationId }),
  ]);

  // Mark messages as seen
  await Message.updateMany(
    { conversationId, senderId: { $ne: actorId }, isSeen: false },
    { isSeen: true },
  );
  await Conversation.findByIdAndUpdate(conversationId, { unreadCount: 0 });

  return { messages: messages.reverse(), total, page, limit, pages: Math.ceil(total / limit) };
};

const sendMessage = async (senderId, senderType, receiverId, receiverType, { message, files }) => {
  if (!message?.trim() && (!files || !files.length)) throw new AppError('message or files required', 400);

  const conv = await getOrCreateConversation(senderId, senderType, receiverId, receiverType);

  const msg = await Message.create({
    conversationId: conv._id,
    senderId, senderType,
    message: message?.trim(),
    files: files || [],
  });

  conv.lastMessageId = msg._id;
  conv.lastMessageTime = new Date();
  conv.unreadCount = (conv.unreadCount || 0) + 1;
  await conv.save();

  // Send push notification to receiver
  try {
    const notifSvc = require('./notification.service');
    await notifSvc.sendToUser(receiverId, receiverType, {
      title: 'New Message',
      description: message?.trim() || 'Attachment',
      type: 'message',
      data: { conversationId: String(conv._id) },
    });
  } catch (_) { /* non-blocking */ }

  return msg;
};

module.exports = { getConversations, getMessages, sendMessage, getOrCreateConversation };
