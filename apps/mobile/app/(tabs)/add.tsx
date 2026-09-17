import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { createHomework, fetchMySubjects, Subject } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export default function AddHomeworkScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState(""); // simple text input, e.g. "2026-09-20 18:00"
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchMySubjects(token).then((s) => {
      setSubjects(s);
      if (s.length > 0) setSubjectId(s[0].id);
    });
  }, [token]);

  async function submit() {
    if (!token || !subjectId || !title || !dueAt) {
      Alert.alert("Bitte alle Felder ausfüllen");
      return;
    }
    setBusy(true);
    try {
      const iso = new Date(dueAt.replace(" ", "T")).toISOString();
      await createHomework(token, { title, description: description || undefined, due_at: iso, subject_id: subjectId });
      setTitle("");
      setDescription("");
      setDueAt("");
      router.push("/(tabs)/home");
    } catch {
      Alert.alert("Konnte Hausaufgabe nicht speichern", "Prüfe das Datumsformat, z.B. 2026-09-20 18:00");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.label}>Fach</Text>
      <View style={styles.subjectRow}>
        {subjects.map((s) => (
          <Pressable
            key={s.id}
            style={[styles.subjectChip, { borderColor: s.color }, subjectId === s.id && { backgroundColor: s.color }]}
            onPress={() => setSubjectId(s.id)}
          >
            <Text style={{ color: subjectId === s.id ? "#0f1115" : s.color, fontWeight: "600" }}>{s.name}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Titel</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="z.B. Seite 42, Aufgabe 3" placeholderTextColor="#9aa0aa" />

      <Text style={styles.label}>Beschreibung (optional)</Text>
      <TextInput style={[styles.input, { height: 80 }]} value={description} onChangeText={setDescription} multiline placeholderTextColor="#9aa0aa" />

      <Text style={styles.label}>Fällig (JJJJ-MM-TT HH:MM)</Text>
      <TextInput style={styles.input} value={dueAt} onChangeText={setDueAt} placeholder="2026-09-20 18:00" placeholderTextColor="#9aa0aa" />

      <Pressable style={styles.button} onPress={submit} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? "Speichert..." : "Hausaufgabe speichern"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1115" },
  label: { color: "#9aa0aa", fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: "#171a21",
    color: "#f2f3f5",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  subjectRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subjectChip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  button: { backgroundColor: "#3b82f6", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 24 },
  buttonText: { color: "white", fontWeight: "700", fontSize: 16 },
});
