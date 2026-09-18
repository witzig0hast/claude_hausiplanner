import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Pressable } from "react-native";
import { createHomework, extractHomeworkFromImage, fetchMySubjects, Subject } from "../../lib/api";
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
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchMySubjects(token).then((s) => {
      setSubjects(s);
      if (s.length > 0) setSubjectId(s[0].id);
    });
  }, [token]);

  function applySuggestion(subjectGuess: string | null, suggestedTitle: string, desc: string | null, dueDateGuess: string | null) {
    if (subjectGuess) {
      const match = subjects.find((s) => s.name.toLowerCase() === subjectGuess.toLowerCase());
      if (match) setSubjectId(match.id);
    }
    setTitle(suggestedTitle);
    if (desc) setDescription(desc);
    if (dueDateGuess) setDueAt(`${dueDateGuess} 18:00`);
  }

  async function scanImage(fromCamera: boolean) {
    if (!token) return;
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Keine Berechtigung", "Ohne Kamera-/Fotozugriff kann kein Foto ausgewertet werden.");
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (result.canceled || result.assets.length === 0) return;

    setScanning(true);
    setScanNote(null);
    try {
      const suggestion = await extractHomeworkFromImage(token, result.assets[0].uri);
      applySuggestion(suggestion.subject_guess, suggestion.title, suggestion.description, suggestion.due_date_guess);
      setScanNote("Vorschlag übernommen - bitte kurz prüfen, bevor du speicherst.");
    } catch {
      Alert.alert("Erkennung fehlgeschlagen", "Der KI-Agent (Ollama) ist evtl. nicht erreichbar. Bitte manuell eintragen.");
    } finally {
      setScanning(false);
    }
  }

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
      setScanNote(null);
      router.push("/(tabs)/home");
    } catch {
      Alert.alert("Konnte Hausaufgabe nicht speichern", "Prüfe das Datumsformat, z.B. 2026-09-20 18:00");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.scanRow}>
        <Pressable style={styles.scanButton} onPress={() => scanImage(true)} disabled={scanning}>
          <Text style={styles.scanButtonText}>📷 Foto aufnehmen</Text>
        </Pressable>
        <Pressable style={styles.scanButton} onPress={() => scanImage(false)} disabled={scanning}>
          <Text style={styles.scanButtonText}>🖼️ Aus Galerie</Text>
        </Pressable>
      </View>
      {scanning && (
        <View style={styles.scanningRow}>
          <ActivityIndicator />
          <Text style={styles.scanningText}>KI liest die Hausaufgabe...</Text>
        </View>
      )}
      {scanNote && <Text style={styles.scanNote}>{scanNote}</Text>}

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
  scanRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  scanButton: { flex: 1, backgroundColor: "#171a21", borderRadius: 10, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  scanButtonText: { color: "#f2f3f5", fontWeight: "600" },
  scanningRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  scanningText: { color: "#9aa0aa" },
  scanNote: { color: "#22c55e", marginTop: 8 },
});
