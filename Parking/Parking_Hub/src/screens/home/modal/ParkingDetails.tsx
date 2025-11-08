import React from 'react';
import { Modal, View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CalendarPickerModal from '../../../components/CalendarPickerModal';
import VehiclePickerModal from '../../../components/VehiclePickerModal';
import { useVehicles } from '../../../contexts/vehicles/VehicleContext';
import {
  createResponsiveStyles,
  scaledFont,
  scaledSpacing,
  getModalWidth,
  getCardPadding,
  getButtonHeight,
  SCREEN_WIDTH
} from '../../../utils/responsive';

interface ParkingSpace {
  id: string;
  space_number: string;
  section: string;
  address?: string;
  daily_rate?: number;
  image?: string;
  category?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  space: ParkingSpace | null;
  onStartBooking?: (booking: { space: ParkingSpace; startTime: Date; endTime: Date; vehicleId: string | null }) => void;
}

const FALLBACK_IMAGE = require('../../../../assets/images/Car.jpg');

const ParkingDetails: React.FC<Props> = ({ visible, onClose, space, onStartBooking }) => {
  if (!space) return null;

  // Normalize start date to start of day so comparisons and day counts are correct
  const [startTime] = React.useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [endTime, setEndTime] = React.useState<Date | null>(null);
  const [pickerMode, setPickerMode] = React.useState<'end' | null>(null);
  const [vehicleModal, setVehicleModal] = React.useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<string | null>(null);
  const vehicleRequired = true;
  const { vehicles } = useVehicles();

  const today = React.useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const handleConfirm = (date: Date) => {
    // Reject past dates
    const picked = new Date(date);
    picked.setHours(0, 0, 0, 0);
    if (picked < today) {
      Alert.alert('Invalid Date', 'You cannot choose a past date.');
      return;
    }

    if (pickerMode === 'end') {
      // Ensure end date (date-only) is not before start date (date-only)
      const startDay = new Date(startTime);
      startDay.setHours(0, 0, 0, 0);
      if (picked < startDay) {
        Alert.alert('Invalid End Date', 'End date cannot be before start date.');
        return;
      }
      // Prevent same-day bookings (end date must be at least 1 day after start date)
      if (picked.getTime() === startDay.getTime()) {
        Alert.alert('Invalid End Date', 'End date must be at least 1 day after start date. Please select a different date.');
        return;
      }
      setEndTime(picked);
    }
    setPickerMode(null);
  };

  const formattedDate = (d: Date | null) => {
    if (!d) return '-- --';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={28} color="#FFD700" />
          </TouchableOpacity>

          {/* Image */}
          <Image
            source={space.image ? { uri: space.image } : FALLBACK_IMAGE}
            style={styles.image}
            resizeMode="cover"
          />

          {/* Title + address */}
          <Text style={styles.title}>{`${space.category ?? 'Parking'} / ${space.space_number}`}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons name="location-outline" size={16} color="#FF3B30" />
            <Text style={styles.address}>{space.address ?? space.section}</Text>
          </View>

          {/* Booking Section */}
          <View style={styles.bookingContainer}>
            <Text style={styles.bookingHeadLine}>Book your car{"\n"}
              <Text style={styles.bookingHeadBold}>Parking</Text>
            </Text>

            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryLocation}>{space.address ?? space.section}</Text>
                <Text style={styles.summarySpace}>{space.space_number}</Text>

                {/* Vehicle */}
                <Text style={styles.timeLabel}>Vehicle Management</Text>
                <TouchableOpacity style={styles.timeBtn} onPress={() => setVehicleModal(true)}>
                  <Text style={styles.timeBtnText}>
                    {selectedVehicleId ? 
                      (() => {
                        const vehicle = vehicles.find(v => v.id === selectedVehicleId);
                        return vehicle ? `${vehicle.vehicle_model} • ${vehicle.vehicle_plate_number}` : 'Vehicle';
                      })() 
                      : 'Select Vehicle'
                    }
                  </Text>
                </TouchableOpacity>

                {/* Time slot */}
                <Text style={styles.timeLabel}>Date Slot</Text>
                <View style={styles.timeRow}>
                  <View style={styles.timeBtn /* non-clickable */}>
                    <Text style={styles.timeBtnText}>{formattedDate(startTime)}</Text>
                  </View>
                  <Text style={styles.toText}>—</Text>
                  <TouchableOpacity style={styles.timeBtn} onPress={() => setPickerMode('end')}>
                    <Text style={styles.timeBtnText}>{endTime ? formattedDate(endTime) : 'End'}</Text>
                  </TouchableOpacity>
                </View>
                {endTime && (
                  <Text style={styles.periodText}>{`${formattedDate(startTime)} — ${formattedDate(endTime)}`}</Text>
                )}
              </View>
              <View style={styles.priceColumn}>
                <View style={styles.mapThumb}>
                  <Ionicons name="location" size={28} color="#0F0F2E" />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 12 }}>
                  <Text style={styles.priceMain}>₱{space.daily_rate}</Text>
                  <Text style={styles.priceUnit}>/day</Text>
                </View>
              </View>
            </View>

            {/* Start Booking */}
            <TouchableOpacity
              style={[
                styles.bookBtn,
                (!selectedVehicleId || !endTime) && { opacity: 0.6 },
              ]}
              onPress={() => {
                if (vehicleRequired && !selectedVehicleId) {
                  Alert.alert('Vehicle Required', 'Please select a vehicle to continue.');
                  setVehicleModal(true);
                  return;
                }
                if (!endTime) {
                  Alert.alert('Date Required', 'Please select an end date.');
                  setPickerMode('end');
                  return;
                }
                if (onStartBooking) {
                  // Normalize to inclusive full-day range: start 00:00, end 23:59:59.999
                  const start = new Date(startTime);
                  start.setHours(0, 0, 0, 0);
                  const end = new Date(endTime);
                  end.setHours(23, 59, 59, 999);
                  onStartBooking({
                    space,
                    startTime: start,
                    endTime: end,
                    vehicleId: selectedVehicleId,
                  });
                } else {
                  onClose();
                }
              }}
              activeOpacity={0.8}
              disabled={!selectedVehicleId || !endTime}
            >
              <Text style={styles.bookTxt}>Start Booking</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {/* Time pickers */}
      <CalendarPickerModal
        visible={pickerMode === 'end'}
        initialDate={endTime ?? startTime}
        fromDate={startTime}
        onConfirm={handleConfirm}
        onCancel={() => setPickerMode(null)}
      />
      <VehiclePickerModal
        visible={vehicleModal}
        onClose={() => setVehicleModal(false)}
        onSelect={(id) => setSelectedVehicleId(id)}
        filterType={space.category?.toLowerCase()}
      />
    </Modal>
  );
};

const createStyles = () => {
  const responsive = createResponsiveStyles();
  const modalWidth = getModalWidth();
  const cardPadding = getCardPadding();
  const buttonHeight = getButtonHeight();
  
  const closeBtnSize = responsive.isSmallScreen ? 36 : 40;
  const imageHeight = responsive.isSmallScreen ? SCREEN_WIDTH * 0.4 : SCREEN_WIDTH * 0.5;
  const mapThumbSize = responsive.isSmallScreen ? 56 : responsive.isMediumScreen ? 62 : 68;
  
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      width: modalWidth,
      backgroundColor: '#1a1a1a',
      borderRadius: 24,
      paddingBottom: scaledSpacing(24),
      alignItems: 'center',
      maxHeight: '90%',

      // Shadow for iOS
      shadowColor: '#000',
      shadowOpacity: 0.5,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      // Elevation for Android
      elevation: 8,
    },
    closeBtn: {
      position: 'absolute',
      top: scaledSpacing(12),
      left: scaledSpacing(12),
      width: closeBtnSize,
      height: closeBtnSize,
      borderRadius: closeBtnSize / 2,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2,
    },
    image: {
      width: '100%',
      height: imageHeight,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    title: {
      fontFamily: 'Raleway-Bold',
      fontSize: scaledFont(20),
      color: '#fff',
      marginTop: scaledSpacing(16),
      textAlign: 'center',
      paddingHorizontal: responsive.padding,
    },
    address: {
      fontFamily: 'Raleway-Regular',
      fontSize: scaledFont(13),
      color: '#ccc',
      marginLeft: 4,
    },
    bookingContainer: {
      width: '100%',
      backgroundColor: '#222',
      borderRadius: 24,
      padding: cardPadding,
      marginTop: scaledSpacing(24),
      marginHorizontal: responsive.padding,
    },
    bookingHeadLine: {
      fontFamily: 'Raleway-Light',
      fontSize: scaledFont(20),
      color: '#fff',
      marginBottom: scaledSpacing(12),
    },
    bookingHeadBold: {
      fontFamily: 'Raleway-Bold',
      fontSize: scaledFont(28),
      color: '#fff',
    },
    summaryCard: {
      flexDirection: 'row',
      backgroundColor: '#333',
      borderRadius: 18,
      padding: cardPadding,
      marginBottom: scaledSpacing(20),
    },
    summaryLocation: {
      fontFamily: 'Raleway-Regular',
      color: '#ccc',
      fontSize: scaledFont(12),
    },
    summarySpace: {
      fontFamily: 'Rakkas-Regular',
      color: '#fff',
      fontSize: scaledFont(26),
      marginTop: 4,
    },
    timeLabel: {
      fontFamily: 'Raleway-Regular',
      color: '#ccc',
      fontSize: scaledFont(12),
      marginTop: scaledSpacing(12),
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: scaledSpacing(6),
    },
    toText: {
      color: '#fff',
      fontSize: scaledFont(16),
      marginHorizontal: scaledSpacing(6),
    },
    timeBtn: {
      backgroundColor: '#333',
      paddingVertical: scaledSpacing(6),
      paddingHorizontal: scaledSpacing(12),
      borderRadius: 8,
    },
    timeBtnText: {
      fontFamily: 'Rakkas-Regular',
      fontSize: scaledFont(14),
      color: '#FFD700',
    },
    timeValue: { /* deprecated but kept if elsewhere */ },
    priceColumn: {
      alignItems: 'flex-end',
    },
    priceMain: {
      fontFamily: 'Rakkas-Regular',
      fontSize: scaledFont(24),
      color: '#FFD700',
    },
    priceUnit: {
      fontFamily: 'Raleway-Medium',
      fontSize: scaledFont(12),
      color: '#FFD700',
      marginLeft: 2,
      marginBottom: 2,
    },
    mapThumb: {
      width: mapThumbSize,
      height: mapThumbSize,
      borderRadius: 12,
      backgroundColor: '#F0F0F0',
      justifyContent: 'center',
      alignItems: 'center',
    },
    bookBtn: {
      backgroundColor: '#FFD700',
      width: '100%',
      height: buttonHeight,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bookTxt: {
      fontFamily: 'Raleway-Bold',
      fontSize: scaledFont(16),
      color: '#000',
    },
    periodText: {
      fontFamily: 'Raleway-Regular',
      fontSize: scaledFont(12),
      color: '#FFD700',
      marginTop: scaledSpacing(6),
    },
  });
};

const styles = createStyles();

export default ParkingDetails;