/**
 * Firebase Cloud Messaging — HTTP v1 API
 * Env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

let _auth = null;

const getAccessToken = async () => {
  if (!process.env.FIREBASE_PROJECT_ID) return null;
  try {
    if (!_auth) {
      const { google } = require('googleapis');
      _auth = new google.auth.JWT(
        process.env.FIREBASE_CLIENT_EMAIL,
        null,
        (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/firebase.messaging'],
      );
    }
    const token = await _auth.getAccessToken();
    return token.token;
  } catch (e) {
    console.error('[FCM] getAccessToken error:', e.message);
    return null;
  }
};

const sendToDevice = async (fcmToken, { title, body, image, data = {} }) => {
  if (!fcmToken || !process.env.FIREBASE_PROJECT_ID) return null;
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/messages:send`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            notification: { title, body, ...(image ? { image } : {}) },
            data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
          },
        }),
        signal: AbortSignal.timeout(5000),
      },
    );
    return res.ok;
  } catch (e) {
    console.error('[FCM] sendToDevice error:', e.message);
    return false;
  }
};

const sendToTopic = async (topic, { title, body, image, data = {} }) => {
  if (!process.env.FIREBASE_PROJECT_ID) return null;
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/messages:send`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          message: {
            topic,
            notification: { title, body, ...(image ? { image } : {}) },
            data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
          },
        }),
        signal: AbortSignal.timeout(5000),
      },
    );
    return res.ok;
  } catch (e) {
    console.error('[FCM] sendToTopic error:', e.message);
    return false;
  }
};

const subscribeToTopic = async (fcmToken, topic) => {
  if (!fcmToken || !process.env.FIREBASE_PROJECT_ID) return;
  const accessToken = await getAccessToken();
  if (!accessToken) return;
  try {
    await fetch(
      `https://iid.googleapis.com/iid/v1/${fcmToken}/rel/topics/${topic}`,
      { method: 'POST', headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(5000) },
    );
  } catch (e) {
    console.error('[FCM] subscribeToTopic error:', e.message);
  }
};

module.exports = { sendToDevice, sendToTopic, subscribeToTopic };
