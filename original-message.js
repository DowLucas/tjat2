const getOriginalMessage = async (app, channel, timestamp) => {
  const threadRes = await app.client.conversations.replies({
    token: process.env.SLACK_BOT_TOKEN,
    channel: channel,
    ts: timestamp,
  });

  if (!threadRes.ok || !threadRes.messages || threadRes.messages.length === 0) {
    console.log("Could not fetch thread messages.");
    return;
  }

  // The parent message is the first message in the thread
  const parentMessage = threadRes.messages[0];

  // Use Bolt's client to fetch reactions for the parent message
  const reactionsRes = await app.client.reactions.get({
    token: process.env.SLACK_BOT_TOKEN,
    channel: channel,
    timestamp: parentMessage.ts,
  });

  if (!reactionsRes.ok || !reactionsRes.message) {
    console.log("Could not fetch message reactions.");
    return;
  }

  return reactionsRes;
};

module.exports = { getOriginalMessage };
