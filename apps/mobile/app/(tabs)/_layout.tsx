import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0f1115" },
        headerTintColor: "#f2f3f5",
        tabBarStyle: { backgroundColor: "#171a21", borderTopColor: "rgba(255,255,255,0.08)" },
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#9aa0aa",
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Hausaufgaben" }} />
      <Tabs.Screen name="add" options={{ title: "Hinzufügen" }} />
      <Tabs.Screen name="plan" options={{ title: "Planung" }} />
      <Tabs.Screen name="chat" options={{ title: "Chat" }} />
      <Tabs.Screen name="settings" options={{ title: "Mehr" }} />
    </Tabs>
  );
}
