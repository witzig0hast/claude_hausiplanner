import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { login, register } from "../lib/api";
import { useAuth } from "../lib/auth";
import { registerForPushNotifications } from "../lib/push";

export default function LoginScreen() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const data =
        mode === "login"
          ? await login(email, password)
          : await register(email, password, displayName, inviteCode || undefined);
      await setSession(data.access_token, data.user);
      registerForPushNotifications(data.access_token).catch(() => {});
      router.replace("/(tabs)/home");
    } catch {
      setError(mode === "login" ? "E-Mail oder Passwort falsch." : "Registrierung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{mode === "login" ? "Einloggen" : "Konto erstellen"}</Text>

      <TextInput
        style={styles.input}
        placeholder="E-Mail"
        placeholderTextColor="#9aa0aa"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Passwort"
        placeholderTextColor="#9aa0aa"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {mode === "register" && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Dein Name"
            placeholderTextColor="#9aa0aa"
            value={displayName}
            onChangeText={setDisplayName}
          />
          <TextInput
            style={styles.input}
            placeholder="Einladungscode (leer = neue Klasse anlegen)"
            placeholderTextColor="#9aa0aa"
            value={inviteCode}
            onChangeText={setInviteCode}
          />
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{mode === "login" ? "Einloggen" : "Registrieren"}</Text>}
      </Pressable>

      <Pressable onPress={() => setMode(mode === "login" ? "register" : "login")}>
        <Text style={styles.link}>{mode === "login" ? "Noch kein Konto? Registrieren" : "Schon ein Konto? Einloggen"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1115", padding: 24, justifyContent: "center" },
  title: { color: "#f2f3f5", fontSize: 28, fontWeight: "700", marginBottom: 24 },
  input: {
    backgroundColor: "#171a21",
    color: "#f2f3f5",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  button: { backgroundColor: "#3b82f6", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 8 },
  buttonText: { color: "white", fontWeight: "600", fontSize: 16 },
  link: { color: "#3b82f6", textAlign: "center", marginTop: 16 },
  error: { color: "#f87171", marginBottom: 8 },
});
