const { App } = require("@slack/bolt");
const { WebClient } = require("@slack/web-api");

require("dotenv").config();

console.log(process.env.SLACK_BOT_TOKEN);
console.log(process.env.SLACK_SIGNING_SECRET);

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  webClient: new WebClient(process.env.SLACK_BOT_TOKEN),
});

BOT_ID = "U06R6Q8F15L";

// Regex should only be triggered when the bot is mentioned
// Format: @botname remind :reaction:
REGEX = new RegExp(`^<@${BOT_ID}> remind :([a-z]+):$`);

// Listen to message events
app.message(REGEX, async ({ message, say }) => {
  const reaction = message.text.match(REGEX)[1];
  // Check the message is in a thread
  if (message.thread_ts) {
    await remindUsers(
      app,
      message.channel,
      message.thread_ts,
      reaction,
      message.thread_ts
    );
  } else {
    await say("Please use threads to remind users.");
  }
});

const remindUsers = async (
  app, // Pass the Bolt app instance for accessing the client
  channel,
  timestamp,
  reaction,
  thread_ts
) => {
  try {
    // Use Bolt's client to fetch reactions for the message
    const reactionsRes = await app.client.reactions.get({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channel,
      timestamp: timestamp,
    });

    if (!reactionsRes.ok || !reactionsRes.message) {
      console.log("Could not fetch message reactions.");
      return;
    }

    // Check if the reaction is present

    targetReaction = null;

    if (reactionsRes.message.reactions) {
      targetReaction = reactionsRes.message.reactions.find(
        (r) => r.name === reaction
      );
    }

    // Fetch users in the channel
    const usersRes = await app.client.conversations.members({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channel,
    });

    if (!usersRes.ok || !usersRes.members) {
      console.log("Could not fetch channel members.");
      return;
    }

    let usersToRemind;

    // If the reaction is not found, remind all users
    if (!targetReaction) {
      console.log(
        `Reaction ${reaction} not found on this message. Reminding all users.`
      );
      usersToRemind = usersRes.members;
    } else {
      // If the reaction is found, remind users who have not reacted
      usersToRemind = usersRes.members.filter(
        (user) => !targetReaction.users.includes(user)
      );
    }

    // Exclude the bot from the list
    usersToRemind = usersToRemind.filter((user) => user !== BOT_ID);

    // Post a reminder message
    if (usersToRemind.length > 0) {
      const usersToMention = usersToRemind.map((user) => `<@${user}>`);
      const reminderText = `Kom igen nu hörni! Gör det som ska göras och reacta sedan med :${reaction}: ${usersToMention.join(
        " @"
      )}`;
      await app.client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: channel,
        thread_ts: thread_ts,
        text: reminderText,
      });
    } else {
      const noReminderText = "Vilken grej! Ingen att påminna!";
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

(async () => {
  const port = process.env.PORT || 3000; // Define a port
  await app.start(port);
  console.log(`⚡️ Bolt app is running on port ${port}!`);
})();
