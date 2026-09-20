import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../lib/auth";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="flashcards/[deckId]"
          options={{ headerShown: true, headerStyle: { backgroundColor: "#0f1115" }, headerTintColor: "#f2f3f5", title: "Deck" }}
        />
      </Stack>
    </AuthProvider>
  );
}
