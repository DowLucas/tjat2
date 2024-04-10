const remindUsersForAllReactions = async (
  app,
  channel,
  timestamp,
  reactions,
  thread_ts
) => {
  try {
    const reactionsRes = await app.client.reactions.get({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channel,
      timestamp: timestamp,
    });

    if (!reactionsRes.ok || !reactionsRes.message) {
      console.log("Could not fetch message reactions.");
      return;
    }

    const messageReactions = reactionsRes.message.reactions || [];
    let usersToRemind = new Set();

    const usersRes = await app.client.conversations.members({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channel,
    });

    if (!usersRes.ok || !usersRes.members) {
      console.log("Could not fetch channel members.");
      return;
    }

    let channelMembers = new Set(usersRes.members);
    channelMembers.delete(BOT_ID); // Exclude the bot

    // For each reaction, check who has not reacted
    reactions.forEach((requestedReaction) => {
      const targetReaction = messageReactions.find(
        (r) => r.name === requestedReaction
      );

      if (targetReaction) {
        const usersWhoReacted = new Set(targetReaction.users);
        channelMembers.forEach((user) => {
          if (!usersWhoReacted.has(user)) {
            usersToRemind.add(user);
          }
        });
      } else {
        // If any reaction is not found, remind all users
        channelMembers.forEach((user) => usersToRemind.add(user));
      }
    });

    // Post reminder
    if (usersToRemind.size > 0) {
      const usersToMention = Array.from(usersToRemind)
        .map((user) => `<@${user}>`)
        .join(" ");
      const reactionsList = reactions.map((r) => `:${r}:`).join(" och ");
      const reminderText = `Nu är det dags att tjata lite! Reacta med ${reactionsList} ovan, ${usersToMention}`;
      await app.client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: channel,
        thread_ts: thread_ts,
        text: reminderText,
      });
    } else {
      const noReminderText =
        "Everyone has reacted with the required reactions. No reminders needed!";
      await app.client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: channel,
        thread_ts: thread_ts,
        text: noReminderText,
      });
    }
  } catch (error) {
    console.error(error);
  }
};

module.exports = remindUsersForAllReactions;
