import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { fetchAgentSummary, fetchMyHomework, fetchWorkload, Homework, toggleComplete, Workload } from "../../lib/api";
import { useAuth } from "../../lib/auth";

const LEVEL_COLOR: Record<Workload["level"], string> = { green: "#22c55e", yellow: "#f59e0b", red: "#ef4444" };
const LEVEL_LABEL: Record<Workload["level"], string> = { green: "Entspannt", yellow: "Machbar", red: "Eng" };

function formatDue(due: string) {
  return new Date(due).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HomeScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<Homework[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [workload, setWorkload] = useState<Workload | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const hw = await fetchMyHomework(token);
    setItems(hw);
    fetchAgentSummary(token).then((s) => setSummary(s.summary)).catch(() => {});
    fetchWorkload(token).then(setWorkload).catch(() => {});
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleToggle(hw: Homework) {
    if (!token) return;
    await toggleComplete(token, hw.id, !hw.completed_by_me);
    load();
  }

  return (
    <View style={styles.container}>
      {workload && (
        <View style={styles.workloadRow}>
          <View style={[styles.dot, { backgroundColor: LEVEL_COLOR[workload.level] }]} />
          <Text style={styles.workloadLabel}>{LEVEL_LABEL[workload.level]}</Text>
          <Text style={styles.workloadMessage}> · {workload.message}</Text>
        </View>
      )}
      {summary && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Dein Assistent meint</Text>
          <Text style={styles.summaryText}>{summary}</Text>
        </View>
      )}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>Nichts offen. 🎉</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, item.completed_by_me && styles.cardDone]}>
            <View style={[styles.tag, { backgroundColor: item.subject.color }]}>
              <Text style={styles.tagText}>{item.subject.name}</Text>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}
            <Text style={styles.due}>Fällig: {formatDue(item.due_at)}</Text>
            <Pressable style={styles.doneButton} onPress={() => handleToggle(item)}>
              <Text style={styles.doneButtonText}>
                {item.completed_by_me ? "Als offen markieren" : "Als erledigt markieren"}
              </Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1115" },
  workloadRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", margin: 16, marginBottom: 0 },
  dot: { width: 10, height: 10, borderRadius: 999, marginRight: 8 },
  workloadLabel: { color: "#f2f3f5", fontWeight: "700" },
  workloadMessage: { color: "#9aa0aa" },
  summaryCard: { margin: 16, marginBottom: 0, backgroundColor: "#171a21", borderRadius: 14, padding: 16 },
  summaryLabel: { color: "#9aa0aa", fontSize: 12, marginBottom: 4, textTransform: "uppercase" },
  summaryText: { color: "#f2f3f5", fontSize: 15, lineHeight: 21 },
  card: { backgroundColor: "#171a21", borderRadius: 14, padding: 16 },
  cardDone: { opacity: 0.5 },
  tag: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, marginBottom: 6 },
  tagText: { color: "#0f1115", fontWeight: "700", fontSize: 12 },
  cardTitle: { color: "#f2f3f5", fontSize: 17, fontWeight: "600" },
  cardDesc: { color: "#9aa0aa", marginTop: 4 },
  due: { color: "#9aa0aa", marginTop: 8, fontSize: 13 },
  doneButton: { marginTop: 12, backgroundColor: "#3b82f6", borderRadius: 10, padding: 10, alignItems: "center" },
  doneButtonText: { color: "white", fontWeight: "600" },
  empty: { color: "#9aa0aa", textAlign: "center", marginTop: 40 },
});
