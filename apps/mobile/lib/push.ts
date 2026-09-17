import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPushToken } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Registers this device for calm reminder pushes - a single alert per event, no repeat spam. */
export async function registerForPushNotifications(authToken: string) {
  if (!Device.isDevice) return; // simulators can't receive push tokens

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;

  const expoPushToken = (await Notifications.getExpoPushTokenAsync()).data;
  const platform = Platform.OS === "ios" ? "ios" : "android";
  await registerPushToken(authToken, expoPushToken, platform);

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Hausaufgaben-Erinnerungen",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });
  }
}
