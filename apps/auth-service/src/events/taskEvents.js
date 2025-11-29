const User = require("../models/User");
const { consumeEvent } = require("../utils/rabbitMq");

async function setupTaskEventConsumer() {
  await consumeEvent("user_task_update", "task.created", async (eventData) => {
    const { userId, taskId } = eventData;
    try {
      await User.findByIdAndUpdate(userId, { $push: { tasks: taskId } });
      console.log(`Task ${taskId} added to user ${userId}`);
    } catch (err) {
      console.error("Failed to update user:", err);
    }
  });
}

setupTaskEventConsumer();
