import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Flashcard, generateFlashcards } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export default function FlashcardsScreen() {
  const { token } = useAuth();
  const [text, setText] = useState("");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);

  async function handleGenerate() {
    if (!token || !text.trim()) return;
    setBusy(true);
    setCards([]);
    setFlipped({});
    try {
      const res = await generateFlashcards(token, text);
      setCards(res.cards);
      if (res.cards.length === 0) {
        Alert.alert("Keine Karteikarten", "Der Agent konnte daraus keine Karteikarten erstellen.");
      }
    } catch {
      Alert.alert("Nicht erreichbar", "Der KI-Agent (Ollama) ist gerade nicht erreichbar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <TextInput
        style={[styles.input, { height: 120 }]}
        multiline
        value={text}
        onChangeText={setText}
        placeholder="Lernstoff einfügen..."
        placeholderTextColor="#9aa0aa"
      />
      <Pressable style={styles.button} onPress={handleGenerate} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Karteikarten erstellen</Text>}
      </Pressable>

      {cards.map((card, i) => (
        <Pressable
          key={i}
          style={styles.card}
          onPress={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))}
        >
          <Text style={styles.cardLabel}>{flipped[i] ? "ANTWORT" : "FRAGE"} · zum Umdrehen tippen</Text>
          <Text style={styles.cardText}>{flipped[i] ? card.answer : card.question}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1115" },
  input: {
    backgroundColor: "#171a21",
    color: "#f2f3f5",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 12,
  },
  button: { backgroundColor: "#3b82f6", borderRadius: 10, padding: 14, alignItems: "center" },
  buttonText: { color: "white", fontWeight: "700" },
  card: { backgroundColor: "#171a21", borderRadius: 14, padding: 16, marginTop: 12 },
  cardLabel: { color: "#9aa0aa", fontSize: 11, marginBottom: 6, textTransform: "uppercase" },
  cardText: { color: "#f2f3f5", fontSize: 16 },
});
