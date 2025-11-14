import React from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// NOTE: Keep this in sync with ParkingDetails.tsx
interface ParkingSpace {
  id: string;
  space_number: string;
  section: string;
  address?: string;
  daily_rate?: number;
  image?: string;
  category?: string;
}

export interface BookingInfo {
  space: ParkingSpace;
  startTime: Date;
  endTime: Date;
  sessionId?: string; // newly added to reference the booking session in DB
  vehicleId?: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  booking: BookingInfo | null;
}

const FALLBACK_IMAGE = require('../../../../assets/images/Car.jpg');

const BookingReceiptModal: React.FC<Props> = ({ visible, onClose, booking }) => {
  if (!booking) return null;

  const { space, startTime, endTime, vehicleId } = booking;

  // Helper to format date nicely
  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);

  // Calculate QR code size - balanced for all screen sizes
  const qrSize = Math.min(SCREEN_HEIGHT * 0.22, SCREEN_WIDTH * 0.45, 220);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="close" size={32} color="#FFD700" />
        </TouchableOpacity>

        <View style={styles.contentWrapper}>
          <View style={styles.topCard}>
            <Image
              source={space.image ? { uri: space.image } : FALLBACK_IMAGE}
              style={styles.topImage}
              resizeMode="cover"
            />
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 12 }}>
              <Text style={styles.spaceTitle}>{space.category ?? 'Space'} / </Text>
              <Text style={[styles.spaceTitle, styles.digitTitle]}>{space.space_number}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <Ionicons name="location-outline" size={16} color="#FF3B30" />
              <Text style={styles.spaceAddress}>{space.address ? space.address.split(',')[0] : space.section ?? 'Location'}</Text>
            </View>
          </View>

          <View style={styles.container}>
            <Text style={styles.receiptTitle}>Parking Receipt</Text>
            <Text style={styles.receiptSub}>Use the Qr-code for{"\n"}Check - In and Check - Out</Text>

            <View style={styles.ticketCard}>
              <Text style={styles.ticketLocation}>{space.address ? space.address.split(',')[0] : space.category ?? 'Parking'}</Text>
              <Text style={styles.ticketSpace}>{space.space_number}</Text>

              <View style={styles.qrContainer}>
                {/* Encode sessionId when available so the admin QR scan can directly reference the booking */}
                <QRCode
                  value={JSON.stringify({
                    sid: booking.sessionId ?? null,
                    space_id: space.id,
                    vehicle_id: vehicleId ?? null,
                    start: startTime.toISOString(),
                    end: endTime.toISOString(),
                  })}
                  size={qrSize}
                  color="#000"
                  backgroundColor="#FFD700"
                />
              </View>

              <Text style={styles.ticketLabel}>Date</Text>
              <Text style={styles.ticketTime}>{`${fmtDate(startTime)}${startTime.toDateString() !== endTime.toDateString() ? `  —  ${fmtDate(endTime)}` : ''}`}</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeBtn: {
    position: 'absolute',
    top: 60,
    left: 24,
    zIndex: 999,
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topCard: {
    width: '100%',
    alignItems: 'center',
    paddingTop: Math.max(60, SCREEN_HEIGHT * 0.07),
  },
  topImage: {
    width: SCREEN_WIDTH * 0.58,
    height: SCREEN_HEIGHT * 0.16,
    maxWidth: 280,
    maxHeight: 170,
    borderRadius: 12,
  },
  spaceTitle: {
    fontFamily: 'Raleway-Bold',
    fontSize: Math.min(22, SCREEN_WIDTH * 0.052),
    color: '#fff',
  },
  digitTitle: {
    fontFamily: 'Rakkas-Regular',
  },
  spaceAddress: {
    fontFamily: 'Raleway-Regular',
    fontSize: Math.min(14, SCREEN_WIDTH * 0.034),
    color: '#ccc',
    marginLeft: 6,
  },
  container: {
    width: '100%',
    flex: 1,
    backgroundColor: '#222',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 26,
    paddingTop: 28,
    alignItems: 'center',
    paddingBottom: 30,
    marginTop: 16,
  },
  receiptTitle: {
    fontFamily: 'Raleway-Bold',
    color: '#fff',
    fontSize: Math.min(28, SCREEN_WIDTH * 0.07),
  },
  receiptSub: {
    fontFamily: 'Raleway-Regular',
    color: '#ccc',
    textAlign: 'center',
    marginTop: 8,
    fontSize: Math.min(15, SCREEN_WIDTH * 0.037),
  },
  ticketCard: {
    width: '90%',
    backgroundColor: '#333',
    borderRadius: 24,
    padding: 24,
    marginTop: 20,
    marginBottom: 24,
  },
  ticketLocation: {
    fontFamily: 'Raleway-Regular',
    color: '#ccc',
    fontSize: Math.min(15, SCREEN_WIDTH * 0.036),
  },
  ticketSpace: {
    fontFamily: 'Rakkas-Regular',
    color: '#fff',
    fontSize: Math.min(36, SCREEN_WIDTH * 0.085),
    marginTop: 4,
  },
  qrContainer: {
    alignSelf: 'center',
    marginVertical: 16,
  },
  ticketLabel: {
    fontFamily: 'Raleway-Regular',
    color: '#ccc',
    fontSize: Math.min(13, SCREEN_WIDTH * 0.032),
    marginTop: 12,
  },
  ticketTime: {
    fontFamily: 'Rakkas-Regular',
    color: '#fff',
    fontSize: Math.min(17, SCREEN_WIDTH * 0.04),
    marginTop: 4,
  },
});

export default BookingReceiptModal;