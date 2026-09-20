import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { addCard, deleteCard, deleteDeck, DeckDetail, fetchDeck, FlashcardOut, reviewCard } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export default function DeckScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [practicing, setPracticing] = useState(false);
  const [queue, setQueue] = useState<FlashcardOut[]>([]);
  const [current, setCurrent] = useState<FlashcardOut | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    load();
  }, [token, deckId]);

  function load() {
    if (!token || !deckId) return;
    setLoading(true);
    fetchDeck(token, deckId)
      .then(setDeck)
      .catch(() => Alert.alert("Fehler", "Konnte Deck nicht laden."))
      .finally(() => setLoading(false));
  }

  function startPractice() {
    if (!deck) return;
    const due = deck.cards.filter((c) => c.due);
    const list = due.length > 0 ? due : deck.cards;
    setQueue(list.slice(1));
    setCurrent(list[0] ?? null);
    setFlipped(false);
    setDone(list.length === 0);
    setPracticing(true);
  }

  async function handleReview(result: "know" | "again") {
    if (!token || !current) return;
    try {
      await reviewCard(token, current.id, result);
    } catch {
      // keep the flow moving even on a network hiccup
    }
    const next = queue[0] ?? null;
    setQueue((q) => q.slice(1));
    setCurrent(next);
    setFlipped(false);
    if (!next) setDone(true);
  }

  async function handleAddCard() {
    if (!token || !deckId || !question.trim() || !answer.trim()) return;
    const card = await addCard(token, deckId, question.trim(), answer.trim());
    setDeck((d) => (d ? { ...d, cards: [...d.cards, card], card_count: d.card_count + 1, due_count: d.due_count + 1 } : d));
    setQuestion("");
    setAnswer("");
    setShowAdd(false);
  }

  async function handleDeleteCard(cardId: string) {
    if (!token || !deck) return;
    await deleteCard(token, cardId);
    setDeck({ ...deck, cards: deck.cards.filter((c) => c.id !== cardId), card_count: deck.card_count - 1 });
  }

  function handleDeleteDeck() {
    if (!token || !deckId) return;
    Alert.alert("Deck löschen?", "Das betrifft alle Mitschüler.", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen",
        style: "destructive",
        onPress: async () => {
          await deleteDeck(token, deckId);
          router.back();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#9aa0aa" style={{ marginTop: 40 }} />
      </View>
    );
  }
  if (!deck) return null;

  if (practicing && !done && current) {
    return (
      <View style={[styles.container, { padding: 16 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>{deck.title}</Text>
          <Pressable onPress={() => setPracticing(false)}>
            <Text style={styles.link}>Beenden</Text>
          </Pressable>
        </View>
        <Text style={styles.faint}>Noch {queue.length + 1} Karte{queue.length === 0 ? "" : "n"}</Text>

        <Pressable style={styles.flipCard} onPress={() => setFlipped((f) => !f)}>
          <Text style={styles.cardLabel}>{flipped ? "ANTWORT" : "FRAGE"} · zum Umdrehen tippen</Text>
          <Text style={styles.cardText}>{flipped ? current.answer : current.question}</Text>
        </Pressable>

        {flipped && (
          <View style={styles.row}>
            <Pressable style={styles.secondaryButton} onPress={() => handleReview("again")}>
              <Text style={styles.secondaryButtonText}>Nochmal</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={() => handleReview("know")}>
              <Text style={styles.buttonText}>Weiß ich</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  if (practicing && done) {
    return (
      <View style={[styles.container, { padding: 16, alignItems: "center", justifyContent: "center" }]}>
        <Text style={styles.heading}>Geschafft!</Text>
        <Text style={styles.faint}>Alle fälligen Karten geübt.</Text>
        <Pressable style={[styles.button, { marginTop: 16 }]} onPress={() => { setPracticing(false); load(); }}>
          <Text style={styles.buttonText}>Zurück zum Deck</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.heading}>{deck.title}</Text>
          <Text style={styles.faint}>{deck.card_count} Karten · {deck.due_count} fällig</Text>
        </View>
        <Pressable onPress={handleDeleteDeck}>
          <Text style={[styles.link, { color: "#f19999" }]}>Löschen</Text>
        </Pressable>
      </View>

      <Pressable style={styles.button} onPress={startPractice} disabled={deck.cards.length === 0}>
        <Text style={styles.buttonText}>Üben</Text>
      </Pressable>

      <Pressable style={{ marginTop: 14, marginBottom: 6 }} onPress={() => setShowAdd((s) => !s)}>
        <Text style={styles.link}>{showAdd ? "Abbrechen" : "+ Karte manuell hinzufügen"}</Text>
      </Pressable>

      {showAdd && (
        <View style={styles.formCard}>
          <TextInput style={styles.input} placeholder="Frage" placeholderTextColor="#9aa0aa" value={question} onChangeText={setQuestion} />
          <TextInput style={styles.input} placeholder="Antwort" placeholderTextColor="#9aa0aa" value={answer} onChangeText={setAnswer} />
          <Pressable style={styles.button} onPress={handleAddCard}>
            <Text style={styles.buttonText}>Hinzufügen</Text>
          </Pressable>
        </View>
      )}

      {deck.cards.map((card) => (
        <View key={card.id} style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardQuestion}>{card.question}</Text>
            <Text style={styles.faint}>{card.answer}</Text>
          </View>
          <Pressable onPress={() => handleDeleteCard(card.id)}>
            <Text style={[styles.link, { color: "#f19999" }]}>×</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1115" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  heading: { color: "#f2f3f5", fontSize: 20, fontWeight: "700" },
  link: { color: "#3b82f6", fontWeight: "600" },
  faint: { color: "#9aa0aa", fontSize: 13 },
  button: { backgroundColor: "#3b82f6", borderRadius: 10, padding: 14, alignItems: "center", flex: 1 },
  buttonText: { color: "white", fontWeight: "700" },
  secondaryButton: { backgroundColor: "#171a21", borderRadius: 10, padding: 14, alignItems: "center", flex: 1, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  secondaryButtonText: { color: "#f2f3f5", fontWeight: "600" },
  row: { flexDirection: "row", gap: 10, marginTop: 16 },
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
  flipCard: { backgroundColor: "#171a21", borderRadius: 14, padding: 20, marginTop: 16, minHeight: 160, justifyContent: "center" },
  cardLabel: { color: "#9aa0aa", fontSize: 11, marginBottom: 10, textTransform: "uppercase" },
  cardText: { color: "#f2f3f5", fontSize: 17 },
  card: { backgroundColor: "#171a21", borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardQuestion: { color: "#f2f3f5", fontSize: 15, fontWeight: "600", marginBottom: 4 },
});
