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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.topCard}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={32} color="#FFD700" />
          </TouchableOpacity>
          <Image
            source={space.image ? { uri: space.image } : FALLBACK_IMAGE}
            style={styles.topImage}
            resizeMode="cover"
          />
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={styles.spaceTitle}>{space.category ?? 'Space'} / </Text>
            <Text style={[styles.spaceTitle, styles.digitTitle]}>{space.space_number}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
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

            <View style={{ alignSelf: 'center', marginVertical: 12 }}>
              {/* Encode sessionId when available so the admin QR scan can directly reference the booking */}
              <QRCode
                value={JSON.stringify({
                  sid: booking.sessionId ?? null,
                  space_id: space.id,
                  vehicle_id: vehicleId ?? null,
                  start: startTime.toISOString(),
                  end: endTime.toISOString(),
                })}
                size={160}
                color="#000"
                backgroundColor="#FFD700"
              />
            </View>

            <Text style={styles.ticketLabel}>Date</Text>
            <Text style={styles.ticketTime}>{`${fmtDate(startTime)}${startTime.toDateString() !== endTime.toDateString() ? `  —  ${fmtDate(endTime)}` : ''}`}</Text>
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
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  topCard: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 100,
  },
  topImage: {
    width: 220,
    height: 160,
    borderRadius: 12,
  },
  spaceTitle: {
    fontFamily: 'Raleway-Bold',
    fontSize: 20,
    color: '#fff',
    marginTop: 12,
  },
  digitTitle: {
    fontFamily: 'Rakkas-Regular',
  },
  spaceAddress: {
    fontFamily: 'Raleway-Regular',
    fontSize: 13,
    color: '#ccc',
    marginLeft: 6,
  },
  container: {
    width: '90%',
    backgroundColor: '#222',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: 'center',
    paddingBottom: 40,
    marginTop: 24,
  },
  receiptTitle: {
    fontFamily: 'Raleway-Bold',
    color: '#fff',
    fontSize: 26,
  },
  receiptSub: {
    fontFamily: 'Raleway-Regular',
    color: '#ccc',
    textAlign: 'center',
    marginTop: 8,
  },
  ticketCard: {
    width: '100%',
    backgroundColor: '#333',
    borderRadius: 24,
    padding: 24,
    marginTop: 28,
  },
  ticketLocation: {
    fontFamily: 'Raleway-Regular',
    color: '#ccc',
    fontSize: 14,
  },
  ticketSpace: {
    fontFamily: 'Rakkas-Regular',
    color: '#fff',
    fontSize: 32,
    marginTop: 4,
  },
  ticketLabel: {
    fontFamily: 'Raleway-Regular',
    color: '#ccc',
    fontSize: 12,
    marginTop: 8,
  },
  ticketTime: {
    fontFamily: 'Rakkas-Regular',
    color: '#fff',
    fontSize: 16,
    marginTop: 4,
  },
  closeBtn: {
    position: 'absolute',
    top: 80,
    left: 24,
    zIndex: 2,
  },
});

export default BookingReceiptModal;