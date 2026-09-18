import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { CalendarEvent, fetchCalendarEvents, fetchPlanning, PlanningResult } from "../../lib/api";
import { useAuth } from "../../lib/auth";

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

function formatRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const day = s.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
  const time = (d: Date) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return `${day}, ${time(s)}–${time(e)}`;
}

export default function PlanScreen() {
  const { token } = useAuth();
  const [plan, setPlan] = useState<PlanningResult | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const [p, ev] = await Promise.all([fetchPlanning(token, 7), fetchCalendarEvents(token)]);
    setPlan(p);
    setEvents(ev);
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

  const recurring = events.filter((e) => e.is_recurring_weekly && e.weekday !== null);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
    >
      <View>
        <Text style={styles.sectionTitle}>Vorschlag: wann was erledigen</Text>
        {(!plan || plan.suggestions.length === 0) && (
          <Text style={styles.empty}>Aktuell keine Vorschläge - entweder alles erledigt oder kein freies Zeitfenster gefunden.</Text>
        )}
        {plan?.suggestions.map((s) => (
          <View key={s.homework_id} style={styles.card}>
            <Text style={styles.cardTitle}>{s.subject_name}: {s.title}</Text>
            <Text style={styles.cardMeta}>{formatRange(s.start, s.end)} · ca. {s.minutes} Min.</Text>
          </View>
        ))}
        {plan && plan.unscheduled.length > 0 && (
          <View style={styles.warnCard}>
            <Text style={styles.warnTitle}>Eng: kein freier Slot gefunden für</Text>
            {plan.unscheduled.map((title) => (
              <Text key={title} style={styles.warnItem}>· {title}</Text>
            ))}
          </View>
        )}
      </View>

      <View>
        <Text style={styles.sectionTitle}>Stundenplan (wöchentlich)</Text>
        {recurring.length === 0 && <Text style={styles.empty}>Noch kein Stundenplan hinterlegt.</Text>}
        {WEEKDAYS.map((day, idx) => {
          const dayEvents = recurring
            .filter((e) => e.weekday === idx)
            .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
          if (dayEvents.length === 0) return null;
          return (
            <View key={day} style={styles.card}>
              <Text style={styles.cardTitle}>{day}</Text>
              {dayEvents.map((e) => (
                <Text key={e.id} style={styles.cardMeta}>
                  {e.title} · {new Date(e.starts_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                  –{new Date(e.ends_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              ))}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1115" },
  sectionTitle: { color: "#f2f3f5", fontSize: 18, fontWeight: "700", marginBottom: 10 },
  card: { backgroundColor: "#171a21", borderRadius: 14, padding: 16, marginBottom: 10 },
  cardTitle: { color: "#f2f3f5", fontSize: 16, fontWeight: "600" },
  cardMeta: { color: "#9aa0aa", marginTop: 4, fontSize: 13 },
  empty: { color: "#9aa0aa" },
  warnCard: { backgroundColor: "#2a1f17", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#f59e0b" },
  warnTitle: { color: "#f59e0b", fontWeight: "700", marginBottom: 6 },
  warnItem: { color: "#f2f3f5" },
});
