import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f1115" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={token ? "/(tabs)/home" : "/login"} />;
}
