/**
 * Symptom Tracker Screen
 *
 * Lets the patient select current symptoms by category.
 * Header shows today's date; calendar icon opens a month view
 * where past logged days can be tapped to review their entries.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppTheme } from '@/lib/theme/ThemeContext';

// ── Data ────────────────────────────────────────────────────────────

interface Symptom {
  id: string;
  name: string;
  icon: string;
}

interface SymptomCategory {
  id: string;
  label: string;
  color: string;
  symptoms: Symptom[];
}

const CATEGORIES: SymptomCategory[] = [
  {
    id: 'urinary',
    label: 'URINARY',
    color: '#5B9BD5',
    symptoms: [
      { id: 'urgency',    name: 'Urgency',    icon: 'exclamationmark.circle.fill' },
      { id: 'frequency',  name: 'Frequency',  icon: 'repeat.circle.fill' },
      { id: 'nocturia',   name: 'Nocturia',   icon: 'moon.stars.fill' },
      { id: 'weak_stream',name: 'Weak Stream',icon: 'drop.triangle.fill' },
      { id: 'straining',  name: 'Straining',  icon: 'bolt.circle.fill' },
      { id: 'incomplete', name: 'Incomplete\nEmptying', icon: 'arrow.clockwise.circle.fill' },
    ],
  },
  {
    id: 'pain',
    label: 'PAIN',
    color: '#E8805A',
    symptoms: [
      { id: 'pelvic',     name: 'Pelvic',     icon: 'staroflife.fill' },
      { id: 'lower_back', name: 'Lower Back', icon: 'figure.walk' },
      { id: 'bladder',    name: 'Bladder',    icon: 'drop.fill' },
      { id: 'burning',    name: 'Burning',    icon: 'flame.fill' },
      { id: 'groin',      name: 'Groin',      icon: 'cross.circle.fill' },
    ],
  },
  {
    id: 'sleep',
    label: 'SLEEP',
    color: '#8E74C8',
    symptoms: [
      { id: 'interrupted',   name: 'Interrupted',   icon: 'moon.zzz.fill' },
      { id: 'fatigue',       name: 'Fatigue',        icon: 'battery.25' },
      { id: 'drowsy',        name: 'Drowsiness',     icon: 'sun.haze.fill' },
      { id: 'insomnia',      name: 'Insomnia',       icon: 'eye.slash.fill' },
    ],
  },
  {
    id: 'mood',
    label: 'MOOD',
    color: '#E07CA0',
    symptoms: [
      { id: 'anxious',     name: 'Anxious',     icon: 'waveform.path' },
      { id: 'frustrated',  name: 'Frustrated',  icon: 'exclamationmark.triangle.fill' },
      { id: 'depressed',   name: 'Low Mood',    icon: 'cloud.rain.fill' },
      { id: 'stressed',    name: 'Stressed',    icon: 'tornado' },
      { id: 'irritable',   name: 'Irritable',   icon: 'bolt.fill' },
    ],
  },
  {
    id: 'general',
    label: 'GENERAL',
    color: '#4BAE8A',
    symptoms: [
      { id: 'low_energy',   name: 'Low Energy',   icon: 'battery.0' },
      { id: 'reduced_act',  name: 'Less Active',  icon: 'figure.walk.circle.fill' },
      { id: 'concentration',name: 'Brain Fog',    icon: 'brain.head.profile' },
      { id: 'appetite',     name: 'Poor Appetite',icon: 'fork.knife' },
      { id: 'dizzy',        name: 'Dizziness',    icon: 'circle.dashed' },
    ],
  },
];

// Flat lookup: symptom id → { name, color }
const SYMPTOM_MAP: Record<string, { name: string; color: string }> = {};
CATEGORIES.forEach(cat => {
  cat.symptoms.forEach(s => {
    SYMPTOM_MAP[s.id] = { name: s.name.replace('\n', ' '), color: cat.color };
  });
});

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// ── Helpers ──────────────────────────────────────────────────────────

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatDayHeading(date: Date): { weekday: string; monthDay: string } {
  return {
    weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
    monthDay:
      date.toLocaleDateString('en-US', { month: 'long' }) +
      ' ' +
      ordinalSuffix(date.getDate()),
  };
}

function getCalendarCells(monthStart: Date): (Date | null)[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const leadingBlanks = monthStart.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

// ── Component ────────────────────────────────────────────────────────

export default function TrackerScreen() {
  const { theme } = useAppTheme();
  const { isDark, colors: c } = theme;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Persisted logs: YYYY-MM-DD → array of symptom ids
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  // Which past day is selected in the calendar for detail view
  const [historyDay, setHistoryDay] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const { weekday, monthDay } = useMemo(() => formatDayHeading(today), [today]);

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const clearAll = () => setSelected(new Set());

  const handleSave = () => {
    const ids = Array.from(selected);
    setLogs(prev => ({ ...prev, [todayKey]: ids }));
    const count = ids.length;
    Alert.alert(
      'Symptoms Saved',
      count === 0
        ? 'No symptoms recorded for today.'
        : `${count} symptom${count !== 1 ? 's' : ''} recorded for today.`,
    );
  };

  // ── Calendar helpers ──────────────────────────────────────────────

  const calendarCells = useMemo(
    () => getCalendarCells(calendarMonth),
    [calendarMonth],
  );

  const calMonthLabel = calendarMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const prevMonth = useCallback(() => {
    setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    setHistoryDay(null);
  }, []);

  const nextMonth = useCallback(() => {
    setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));
    setHistoryDay(null);
  }, []);

  const isCurrentMonth =
    calendarMonth.getFullYear() === today.getFullYear() &&
    calendarMonth.getMonth() === today.getMonth();

  const historySymptoms: { name: string; color: string }[] = useMemo(() => {
    if (!historyDay || !logs[historyDay]) return [];
    return logs[historyDay]
      .map(id => SYMPTOM_MAP[id])
      .filter(Boolean);
  }, [historyDay, logs]);

  const borderColor = c.separator;
  const sheetBg = c.card;
  const calCellBg = c.secondaryFill;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>

      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: c.separator }]}>
        {/* Date block */}
        <View style={styles.dateBlock}>
          <Text style={[styles.dateWeekday, { color: c.textPrimary }]}>{weekday}</Text>
          <Text style={[styles.dateMonthDay, { color: c.textSecondary }]}>{monthDay}</Text>
        </View>

        {/* Right-side controls */}
        <View style={styles.headerRight}>
          {selected.size > 0 && (
            <TouchableOpacity onPress={clearAll} style={styles.clearButton}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              setHistoryDay(null);
              setCalendarVisible(true);
            }}
            style={styles.calendarButton}
            activeOpacity={0.7}
          >
            <IconSymbol name="calendar" size={24} color={c.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.subtitle, { color: c.textSecondary }]}>
        Track your symptoms to monitor how you&apos;re feeling
      </Text>

      {/* ── Symptom categories ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {CATEGORIES.map(category => {
          const selectedCount = category.symptoms.filter(s => selected.has(s.id)).length;
          return (
            <View key={category.id} style={styles.section}>
              <Text style={[styles.sectionLabel, { color: c.textPrimary }]}>
                {category.label}{' '}
                <Text style={[styles.sectionCount, { color: c.textSecondary }]}>
                  {selectedCount}/{category.symptoms.length}
                </Text>
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillRow}
              >
                {category.symptoms.map(symptom => {
                  const isSelected = selected.has(symptom.id);
                  return (
                    <TouchableOpacity
                      key={symptom.id}
                      style={styles.pillWrapper}
                      onPress={() => toggle(symptom.id)}
                      activeOpacity={0.75}
                    >
                      <View style={[
                        styles.circle,
                        { backgroundColor: category.color },
                        isSelected && styles.circleSelected,
                      ]}>
                        <IconSymbol
                          name={symptom.icon as any}
                          size={28}
                          color="#FFFFFF"
                        />
                        {isSelected && (
                          <View style={styles.checkBadge}>
                            <IconSymbol name="checkmark" size={10} color="#FFFFFF" />
                          </View>
                        )}
                      </View>
                      <Text
                        style={[styles.pillLabel, { color: c.textPrimary }]}
                        numberOfLines={2}
                        textBreakStrategy="simple"
                      >
                        {symptom.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Save button ── */}
      <View style={[styles.footer, { backgroundColor: c.background }]}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.85}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* ── Calendar modal ── */}
      <Modal
        visible={calendarVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCalendarVisible(false)}
      >
        <Pressable
          style={calStyles.backdrop}
          onPress={() => setCalendarVisible(false)}
        >
          <Pressable style={[calStyles.sheet, { backgroundColor: sheetBg }]}>
            {/* Handle */}
            <View style={[calStyles.handle, { backgroundColor: borderColor }]} />

            {/* Month navigation */}
            <View style={calStyles.monthNav}>
              <TouchableOpacity onPress={prevMonth} style={calStyles.navBtn} activeOpacity={0.6}>
                <IconSymbol name="chevron.left" size={18} color={c.textPrimary} />
              </TouchableOpacity>
              <Text style={[calStyles.monthLabel, { color: c.textPrimary }]}>
                {calMonthLabel}
              </Text>
              <TouchableOpacity
                onPress={nextMonth}
                style={calStyles.navBtn}
                activeOpacity={isCurrentMonth ? 0.3 : 0.6}
                disabled={isCurrentMonth}
              >
                <IconSymbol
                  name="chevron.right"
                  size={18}
                  color={isCurrentMonth ? c.textSecondary : c.textPrimary}
                />
              </TouchableOpacity>
            </View>

            {/* Day-of-week headers */}
            <View style={calStyles.dayHeaders}>
              {DAY_LABELS.map(d => (
                <Text key={d} style={[calStyles.dayHeader, { color: c.textSecondary }]}>{d}</Text>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={calStyles.grid}>
              {calendarCells.map((date, idx) => {
                if (!date) {
                  return <View key={`blank_${idx}`} style={calStyles.cell} />;
                }

                const key = toDateKey(date);
                const isToday = key === todayKey;
                const hasLog = !!logs[key];
                const isFuture = date > today && !isToday;
                const isSelected = historyDay === key;

                return (
                  <TouchableOpacity
                    key={key}
                    style={calStyles.cell}
                    activeOpacity={hasLog || isToday ? 0.7 : 1}
                    onPress={() => {
                      if (hasLog) {
                        setHistoryDay(isSelected ? null : key);
                      } else if (isToday) {
                        setCalendarVisible(false);
                      }
                    }}
                  >
                    <View style={[
                      calStyles.dayCircle,
                      isToday && calStyles.dayCircleToday,
                      isSelected && calStyles.dayCircleSelected,
                      { backgroundColor: isToday ? '#8E74C8' : isSelected ? calCellBg : 'transparent' },
                    ]}>
                      <Text style={[
                        calStyles.dayNumber,
                        { color: isToday ? '#FFFFFF' : isFuture ? c.textSecondary : c.textPrimary },
                        isSelected && { color: '#8E74C8' },
                      ]}>
                        {date.getDate()}
                      </Text>
                    </View>
                    {hasLog && (
                      <View style={[calStyles.logDot, { backgroundColor: '#8E74C8' }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Day detail — slides in when a logged day is tapped */}
            {historyDay && (
              <View style={[calStyles.detail, { borderTopColor: borderColor }]}>
                <Text style={[calStyles.detailDate, { color: c.textPrimary }]}>
                  {(() => {
                    const d = new Date(historyDay + 'T12:00:00');
                    const { weekday: wd, monthDay: md } = formatDayHeading(d);
                    return `${wd}, ${md}`;
                  })()}
                </Text>
                {historySymptoms.length === 0 ? (
                  <Text style={[calStyles.detailEmpty, { color: c.textSecondary }]}>
                    No symptoms logged
                  </Text>
                ) : (
                  <View style={calStyles.detailSymptoms}>
                    {historySymptoms.map((s, i) => (
                      <View key={i} style={[calStyles.detailPill, { backgroundColor: s.color + '22' }]}>
                        <Text style={[calStyles.detailPillText, { color: s.color }]}>
                          {s.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ── Calendar styles ───────────────────────────────────────────────────

const calStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  navBtn: {
    padding: 8,
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  dayHeaders: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 4,
    gap: 3,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCircleToday: {
    shadowColor: '#8E74C8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  dayCircleSelected: {
    borderWidth: 2,
    borderColor: '#8E74C8',
  },
  dayNumber: {
    fontSize: 15,
    fontWeight: '400',
  },
  logDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  detail: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 10,
  },
  detailDate: {
    fontSize: 15,
    fontWeight: '600',
  },
  detailEmpty: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  detailSymptoms: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailPill: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  detailPillText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

// ── Main styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dateBlock: {
    gap: 1,
  },
  dateWeekday: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  dateMonthDay: {
    fontSize: 13,
    fontWeight: '400',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearButton: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  clearText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8E74C8',
  },
  calendarButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  sectionCount: {
    fontWeight: '400',
  },
  pillRow: {
    flexDirection: 'row',
    paddingBottom: 4,
    gap: 16,
  },
  pillWrapper: {
    alignItems: 'center',
    width: 72,
  },
  circle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  circleSelected: {
    opacity: 0.95,
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 5,
  },
  checkBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  pillLabel: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
  },
  saveButton: {
    backgroundColor: '#8E74C8',
    borderRadius: 16,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8E74C8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
