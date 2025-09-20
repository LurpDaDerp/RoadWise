const { setGlobalOptions } = require("firebase-functions/v2/options");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

//send Expo notifications
async function sendExpoPush(tokens, title, body) {
  const messages = tokens.map(token => ({
    to: token,
    sound: "default",
    title,
    body,
  }));

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const data = await response.json();
  } catch (err) {
  }
}

exports.notifyOnEmergency = onDocumentUpdated("groups/{groupId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  if (!before || !after) return;

  const beforeMembers = before.memberLocations || {};
  const afterMembers = after.memberLocations || {};

  for (const [uid, member] of Object.entries(afterMembers)) {
    const wasEmergency = beforeMembers[uid]?.emergency || false;
    const isEmergency = member?.emergency || false;

    if (!wasEmergency && isEmergency) {
      console.log(`Emergency detected for user ${uid} in group ${event.params.groupId}`);

      const userSnap = await admin.firestore().collection("users").doc(uid).get();
      const userData = userSnap.exists ? userSnap.data() : {};
      const username = userData.username || "member"; 

      const userDocs = await admin.firestore()
        .collection("users")
        .where("groupId", "==", event.params.groupId)
        .get();

      const tokens = [];
      userDocs.forEach(doc => {
        const data = doc.data();
        if (data.pushToken && doc.id !== uid) {
          tokens.push(data.pushToken);
        }
      });

      if (tokens.length > 0) {
        await sendExpoPush(
          tokens,
          "⚠️ Emergency Alert",
          `${username} signaled an emergency! Click here to view location.` 
        );
      }
    }

    if (wasEmergency && !isEmergency) {
      console.log(`Emergency cleared for user ${uid} in group ${event.params.groupId}`);

      const userSnap = await admin.firestore().collection("users").doc(uid).get();
      const userData = userSnap.exists ? userSnap.data() : {};
      const username = userData.username || "member"; 

      const userDocs = await admin.firestore()
        .collection("users")
        .where("groupId", "==", event.params.groupId)
        .get();

      const tokens = [];
      userDocs.forEach(doc => {
        const data = doc.data();
        if (data.pushToken && doc.id !== uid) {
          tokens.push(data.pushToken);
        }
      });

      if (tokens.length > 0) {
        await sendExpoPush(
          tokens,
          "Emergency Cleared",
          `${username} is no longer in an emergency.` 
        );
      }
    }
  }
});
