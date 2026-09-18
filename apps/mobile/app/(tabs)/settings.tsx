import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { setAgentTone } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export default function SettingsScreen() {
  const { user, token, clearSession, setSession } = useAuth();
  const router = useRouter();

  async function logout() {
    await clearSession();
    router.replace("/login");
  }

  async function handleSetTone(tone: "locker" | "streng") {
    if (!token) return;
    const updated = await setAgentTone(token, tone);
    await setSession(token, updated);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{user?.display_name}</Text>
      <Text style={styles.email}>{user?.email}</Text>
      {user?.is_class_admin && <Text style={styles.badge}>Klassen-Admin</Text>}

      <Text style={styles.sectionTitle}>Tonfall des KI-Agenten</Text>
      <View style={styles.toneRow}>
        <Pressable
          style={[styles.toneButton, user?.agent_tone === "locker" && styles.toneButtonActive]}
          onPress={() => handleSetTone("locker")}
        >
          <Text style={styles.toneButtonText}>Locker</Text>
        </Pressable>
        <Pressable
          style={[styles.toneButton, user?.agent_tone === "streng" && styles.toneButtonActive]}
          onPress={() => handleSetTone("streng")}
        >
          <Text style={styles.toneButtonText}>Streng</Text>
        </Pressable>
      </View>

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
  sectionTitle: { color: "#9aa0aa", marginTop: 32, marginBottom: 10, fontSize: 13, textTransform: "uppercase" },
  toneRow: { flexDirection: "row", gap: 10 },
  toneButton: {
    flex: 1,
    backgroundColor: "#171a21",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  toneButtonActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  toneButtonText: { color: "#f2f3f5", fontWeight: "600" },
  button: { backgroundColor: "#171a21", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 32 },
  buttonText: { color: "#f87171", fontWeight: "600" },
});
