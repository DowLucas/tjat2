const { App } = require("@slack/bolt");
const { WebClient } = require("@slack/web-api");

require("dotenv").config();
const remindUsersForAllReactions = require("./remind-and");
const { getOriginalMessage } = require("./original-message");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  webClient: new WebClient(process.env.SLACK_BOT_TOKEN),
});

BOT_ID = "U06R6Q8F15L";
MARIA = "U06RF51UP9S";

// Regex should only be triggered when the bot is mentioned
// Format: @botname remind :reaction: any other stuff
const REGEX_REMIND = new RegExp(`^<@${BOT_ID}> remind :(.*):.*$`);
const REGEX_REMIND_OR = new RegExp(`^<@${BOT_ID}> remind-or ([^]+).*$`);
const REGEX_REMIND_AND = new RegExp(`^<@${BOT_ID}> remind-and ([^]+).*$`);

// Listen to message events
app.message(async ({ message, say }) => {
  try {
    let reactions = [];
    if (!message.text) {
      return;
    }

    const matchRemind = message.text.match(REGEX_REMIND);
    const matchRemindOr = message.text.match(REGEX_REMIND_OR);
    const matchRemindAnd = message.text.match(REGEX_REMIND_AND);

    if (matchRemind && matchRemind[1]) {
      // Single reaction command
      reactions = [matchRemind[1].trim()];
    } else if (matchRemindOr && matchRemindOr[1]) {
      // remind-or command
      reactions = matchRemindOr[1]
        .split(/[\s,;]+/)
        .map((r) => r.replace(/:/g, "").trim())
        .filter(Boolean);
    } else if (matchRemindAnd && matchRemindAnd[1]) {
      // remind-and command
      reactions = matchRemindAnd[1]
        .split(/[\s,;]+/)
        .map((r) => r.replace(/:/g, "").trim())
        .filter(Boolean);
    }

    // Process each reaction
    if (reactions.length === 1 && message.thread_ts && matchRemind) {
      await remindUsers(
        app,
        message.channel,
        message.thread_ts,
        reactions[0],
        message.ts
      );
    } else if (reactions.length > 1 && message.thread_ts && matchRemindOr) {
      await remindUsersForMultipleReactions(
        app,
        message.channel,
        message.thread_ts,
        reactions,
        message.ts
      );
    } else if (reactions.length > 1 && message.thread_ts && matchRemindAnd) {
      await remindUsersForAllReactions(
        app,
        message.channel,
        message.thread_ts,
        reactions,
        message.ts
      );
    } else if (reactions.length > 0) {
      await say("Please use threads to remind users.");
    }
  } catch (error) {
    console.error(error);
  }
});

const remindUsersForMultipleReactions = async (
  app,
  channel,
  timestamp,
  reactions,
  thread_ts
) => {
  try {
    // Use Bolt's client to fetch reactions for the message
    const reactionsRes = await getOriginalMessage(app, channel, timestamp);

    const messageReactions = reactionsRes.message.reactions || [];
    let usersToRemind = new Set();

    // Fetch users in the channel
    const usersRes = await app.client.conversations.members({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channel,
    });

    if (!usersRes.ok || !usersRes.members) {
      console.log("Could not fetch channel members.");
      return;
    }

    const channelMembers = new Set(usersRes.members);

    // Iterate over each requested reaction to check who hasn't reacted
    reactions.forEach((requestedReaction) => {
      const targetReaction = messageReactions.find(
        (r) => r.name === requestedReaction
      );

      if (targetReaction) {
        // If reaction is found, add users who haven't reacted to the remind set
        targetReaction.users.forEach((user) => {
          if (channelMembers.has(user)) {
            channelMembers.delete(user); // Remove users who have reacted with the current reaction
          }
        });
      }
    });

    // The remaining users in channelMembers need to be reminded
    usersToRemind = channelMembers;

    // Exclude the bot from the list
    usersToRemind.delete(BOT_ID);

    // Post a reminder message
    if (usersToRemind.size > 0) {
      const usersToMention = Array.from(usersToRemind)
        .map((user) => `<@${user}>`)
        .join(" ");
      const reactionsList = reactions.map((r) => `:${r}:`).join(" eller ");
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

const remindUsers = async (
  app, // Pass the Bolt app instance for accessing the client
  channel,
  timestamp,
  reaction,
  thread_ts
) => {
  try {
    // Use Bolt's client to fetch reactions for the message
    const reactionsRes = await getOriginalMessage(app, channel, timestamp);

    // Check if the reaction is present

    let targetReaction = reactionsRes.message.reactions
      ? reactionsRes.message.reactions.find((r) => r.name === reaction)
      : null;

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
      await app.client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: channel,
        thread_ts: thread_ts,
        text: `Hittade ingen som hade reactat med :${reaction}:. Någon måste reagera först innan jag kan påminna någon.`,
      });
      return;
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
        " "
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
