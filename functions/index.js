const { setGlobalOptions } = require("firebase-functions/v2/options");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

// Firestore trigger for emergencies
exports.notifyOnEmergency = onDocumentUpdated("groups/{groupId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  if (!before || !after) return;

  const beforeMembers = before.memberLocations || {};
  const afterMembers = after.memberLocations || {};

  for (const [uid, member] of Object.entries(afterMembers)) {
    const wasEmergency = beforeMembers[uid]?.emergency || false;
    const isEmergency = member?.emergency || false;

    // Only act when emergency changes from false -> true
    if (!wasEmergency && isEmergency) {
      console.log(`🚨 Emergency detected for user ${uid} in group ${event.params.groupId}`);

      // Find all group members and collect their pushTokens
      const userDocs = await admin.firestore()
        .collection("users")
        .where("groupId", "==", event.params.groupId)
        .get();

      const tokens = [];
      userDocs.forEach(doc => {
        const data = doc.data();
        if (data.pushToken && doc.id !== uid) { // don’t notify the one who triggered
          tokens.push(data.pushToken);
        }
      });

      if (tokens.length > 0) {
        const message = {
          notification: {
            title: "🚨 Emergency Alert",
            body: `${uid} signaled an emergency!`,
          },
          tokens,
        };

        try {
          const response = await admin.messaging().sendMulticast(message);
          console.log("✅ Sent emergency notifications:", response.successCount);
        } catch (err) {
          console.error("❌ Error sending notifications:", err);
        }
      }
    }
  }
});
