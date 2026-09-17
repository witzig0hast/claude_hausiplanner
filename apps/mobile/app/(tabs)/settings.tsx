import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../lib/auth";

export default function SettingsScreen() {
  const { user, clearSession } = useAuth();
  const router = useRouter();

  async function logout() {
    await clearSession();
    router.replace("/login");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{user?.display_name}</Text>
      <Text style={styles.email}>{user?.email}</Text>
      {user?.is_class_admin && <Text style={styles.badge}>Klassen-Admin</Text>}

      <Pressable style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Ausloggen</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1115", padding: 24 },
  name: { color: "#f2f3f5", fontSize: 22, fontWeight: "700" },
  email: { color: "#9aa0aa", marginTop: 4 },
  badge: { color: "#3b82f6", marginTop: 8, fontWeight: "600" },
  button: { backgroundColor: "#171a21", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 32 },
  buttonText: { color: "#f87171", fontWeight: "600" },
});
