import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  addMonths,
  subMonths,
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
} from 'date-fns';

interface Props {
  visible: boolean;
  initialDate?: Date | null;
  fromDate?: Date | null; // start of range to highlight
  onCancel: () => void;
  onConfirm: (date: Date) => void;
}

const { width } = Dimensions.get('window');
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const CalendarPickerModal: React.FC<Props> = ({
  visible,
  initialDate,
  fromDate,
  onCancel,
  onConfirm,
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(initialDate ?? new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate ?? new Date());

  // Generate calendar grid for the current month (42 cells – 6 weeks)
  const daysMatrix = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const monthDays = eachDayOfInterval({ start, end });

    const prefix = Array(getDay(start)).fill(null); // leading blanks
    const totalCells = Math.ceil((prefix.length + monthDays.length) / 7) * 7;
    const suffix = Array(totalCells - prefix.length - monthDays.length).fill(null);

    return [...prefix, ...monthDays, ...suffix];
  }, [currentMonth]);

  const handleSelect = (date: Date) => {
    setSelectedDate(date);
    onConfirm(date); // auto-confirm on tap
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
            <TouchableOpacity onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Week labels */}
          <View style={styles.weekRow}>
            {DAY_LABELS.map((d, i) => (
              <Text key={`${d}-${i}`} style={styles.weekLabel}>
                {d}
              </Text>
            ))}
          </View>

          {/* Calendar grid */}
          <LinearGradient
            // Dark subtle gradient matching app theme
            colors={["#333", "#1a1a1a"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.calendarGrid}
          >
            {daysMatrix.map((day, idx) => {
              const isStart = day && fromDate && isSameDay(day, fromDate);
              const isEnd = day && selectedDate && isSameDay(day, selectedDate);
              const inRange =
                day &&
                fromDate &&
                selectedDate &&
                !isStart &&
                !isEnd &&
                day >= fromDate &&
                day <= selectedDate;
              const isSelected = isStart || isEnd;
              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.dayCell}
                  activeOpacity={day ? 0.7 : 1}
                  onPress={() => day && handleSelect(day)}
                  disabled={!day}
                >
                  {day && (
                    <View
                      style={[
                        styles.dayInner,
                        isSelected && styles.selectedDay,
                        inRange && styles.rangeDay,
                      ]}
                    >
                      <Text style={[
                        styles.dayText,
                        isSelected && styles.selectedText,
                      ]}
                      >
                        {format(day, 'd')}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </LinearGradient>

          {/* Cancel */}
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
            <Text style={styles.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const cellSize = width * 0.1;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width * 0.9,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '90%',
    marginBottom: 8,
  },
  headerTitle: {
    fontFamily: 'Rakkas-Regular',
    fontSize: 20,
    color: '#FFD700',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    marginBottom: 6,
  },
  weekLabel: {
    fontFamily: 'Raleway-Medium',
    fontSize: 12,
    color: '#ccc',
    width: cellSize,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 12,
    width: '90%',
    paddingVertical: 8,
    marginBottom: 12,
  },
  dayCell: {
    width: cellSize,
    height: cellSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayInner: {
    width: cellSize * 0.8,
    height: cellSize * 0.8,
    borderRadius: cellSize * 0.4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontFamily: 'Rakkas-Regular',
    fontSize: 14,
    color: '#fff',
  },
  selectedDay: {
    backgroundColor: '#FFD700',
  },
  selectedText: {
    color: '#000',
    fontFamily: 'Rakkas-Regular',
  },
  rangeDay: {
    backgroundColor: 'rgba(255,215,0,0.3)',
  },
  cancelBtn: {
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 20,
  },
  cancelTxt: {
    fontFamily: 'Raleway-Regular',
    color: '#ccc',
    fontSize: 14,
  },
});

export default CalendarPickerModal;
