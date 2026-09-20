import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { createDeck, DeckSummary, fetchDecks } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export default function FlashcardsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    fetchDecks(token)
      .then(setDecks)
      .finally(() => setLoading(false));
  }, [token]);

  useFocusEffect(load);

  async function pickImage(fromCamera: boolean) {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Keine Berechtigung", "Ohne Kamera-/Fotozugriff kein Foto-Upload möglich.");
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (result.canceled || result.assets.length === 0) return;
    setImageUri(result.assets[0].uri);
    setText("");
  }

  async function handleCreate() {
    if (!token || (!text.trim() && !imageUri)) return;
    setBusy(true);
    try {
      const deck = await createDeck(token, { title: title.trim() || undefined, text: text.trim() || undefined, imageUri: imageUri ?? undefined });
      setTitle("");
      setText("");
      setImageUri(null);
      setShowForm(false);
      router.push(`/flashcards/${deck.id}`);
    } catch {
      Alert.alert("Nicht erreichbar", "Der KI-Agent (Ollama) ist gerade nicht erreichbar oder konnte keine Karten erstellen.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Karteikarten</Text>
        <Pressable style={styles.smallButton} onPress={() => setShowForm((s) => !s)}>
          <Text style={styles.smallButtonText}>{showForm ? "Abbrechen" : "+ Neu"}</Text>
        </Pressable>
      </View>

      {showForm && (
        <View style={styles.formCard}>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Titel (optional)"
            placeholderTextColor="#9aa0aa"
          />
          <TextInput
            style={[styles.input, { height: 100 }]}
            multiline
            value={text}
            onChangeText={(v) => { setText(v); if (v) setImageUri(null); }}
            placeholder="Lernstoff einfügen..."
            placeholderTextColor="#9aa0aa"
            editable={!imageUri}
          />
          <View style={styles.row}>
            <Pressable style={styles.secondaryButton} onPress={() => pickImage(true)}>
              <Text style={styles.secondaryButtonText}>Foto aufnehmen</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => pickImage(false)}>
              <Text style={styles.secondaryButtonText}>Aus Galerie</Text>
            </Pressable>
          </View>
          {imageUri && <Text style={styles.faint}>Foto ausgewählt - Text-Feld deaktiviert.</Text>}

          <Pressable style={styles.button} onPress={handleCreate} disabled={busy || (!text.trim() && !imageUri)}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Deck erstellen</Text>}
          </Pressable>
        </View>
      )}

      {loading && <ActivityIndicator color="#9aa0aa" style={{ marginTop: 20 }} />}

      {!loading && decks.length === 0 && !showForm && (
        <Text style={styles.faint}>Noch keine Decks. Erstelle das erste aus Foto oder Text.</Text>
      )}

      {decks.map((deck) => (
        <Pressable key={deck.id} style={styles.card} onPress={() => router.push(`/flashcards/${deck.id}`)}>
          <Text style={styles.cardTitle}>{deck.title}</Text>
          <View style={styles.cardMetaRow}>
            <Text style={styles.faint}>{deck.card_count} Karte{deck.card_count === 1 ? "" : "n"}</Text>
            {deck.due_count > 0 ? (
              <View style={[styles.pill, { backgroundColor: "#4a3714" }]}>
                <Text style={[styles.pillText, { color: "#f0b84e" }]}>{deck.due_count} fällig</Text>
              </View>
            ) : (
              <View style={[styles.pill, { backgroundColor: "#1f4a34" }]}>
                <Text style={[styles.pillText, { color: "#6ee7a8" }]}>gelernt</Text>
              </View>
            )}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1115" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  heading: { color: "#f2f3f5", fontSize: 22, fontWeight: "700" },
  smallButton: { backgroundColor: "#3b82f6", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  smallButtonText: { color: "white", fontWeight: "600" },
  formCard: { backgroundColor: "#171a21", borderRadius: 14, padding: 16, marginBottom: 16 },
  input: {
    backgroundColor: "#0f1115",
    color: "#f2f3f5",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 10,
  },
  row: { flexDirection: "row", gap: 10, marginBottom: 10 },
  secondaryButton: { flex: 1, backgroundColor: "#0f1115", borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  secondaryButtonText: { color: "#f2f3f5", fontWeight: "600" },
  button: { backgroundColor: "#3b82f6", borderRadius: 10, padding: 14, alignItems: "center" },
  buttonText: { color: "white", fontWeight: "700" },
  faint: { color: "#9aa0aa", fontSize: 13, marginBottom: 4 },
  card: { backgroundColor: "#171a21", borderRadius: 14, padding: 16, marginBottom: 12 },
  cardTitle: { color: "#f2f3f5", fontSize: 16, fontWeight: "600", marginBottom: 8 },
  cardMetaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pill: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  pillText: { fontSize: 12, fontWeight: "700" },
});
