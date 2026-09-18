import { useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { chatWithAgent } from "../../lib/api";
import { useAuth } from "../../lib/auth";

type Message = { role: "user" | "agent"; text: string };

export default function ChatScreen() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!token || !question.trim() || busy) return;
    const q = question.trim();
    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuestion("");
    setBusy(true);
    try {
      const res = await chatWithAgent(token, q);
      setMessages((m) => [...m, { role: "agent", text: res.answer }]);
    } catch {
      setMessages((m) => [...m, { role: "agent", text: "Konnte den Agenten nicht erreichen." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlatList
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<Text style={styles.empty}>Frag mich z.B. "Wie viel Zeit brauche ich noch für Mathe?"</Text>}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.agentBubble]}>
            <Text style={styles.bubbleText}>{item.text}</Text>
          </View>
        )}
      />
      {busy && <ActivityIndicator style={{ marginBottom: 8 }} />}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={question}
          onChangeText={setQuestion}
          placeholder="Deine Frage..."
          placeholderTextColor="#9aa0aa"
          onSubmitEditing={send}
        />
        <Pressable style={styles.sendButton} onPress={send}>
          <Text style={styles.sendButtonText}>Senden</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1115" },
  empty: { color: "#9aa0aa", textAlign: "center", marginTop: 40 },
  bubble: { borderRadius: 14, padding: 12, maxWidth: "85%" },
  userBubble: { backgroundColor: "#3b82f6", alignSelf: "flex-end" },
  agentBubble: { backgroundColor: "#171a21", alignSelf: "flex-start" },
  bubbleText: { color: "white" },
  inputRow: { flexDirection: "row", padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  input: {
    flex: 1,
    backgroundColor: "#171a21",
    color: "#f2f3f5",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  sendButton: { backgroundColor: "#3b82f6", borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
  sendButtonText: { color: "white", fontWeight: "600" },
});
