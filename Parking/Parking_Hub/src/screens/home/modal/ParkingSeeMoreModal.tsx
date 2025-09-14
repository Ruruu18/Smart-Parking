import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ParkingDetails from './ParkingDetails';

// Local fallback image used when a parking space has no image
const FALLBACK_IMAGE = require('../../../../assets/images/Car.jpg');

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
  spaces: ParkingSpace[];
  onStartBooking?: (booking: { space: ParkingSpace; startTime: Date; endTime: Date; vehicleId: string | null }) => void;
}

const ParkingSeeMoreModal: React.FC<Props> = ({ visible, onClose, spaces, onStartBooking }) => {
  const [selectedSpace, setSelectedSpace] = useState<ParkingSpace | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const openDetail = (space: ParkingSpace) => {
    setSelectedSpace(space);
    setDetailVisible(true);
  };

  const closeDetail = () => {
    setDetailVisible(false);
    setSelectedSpace(null);
  };

  const handleParentClose = () => {
    closeDetail();
    onClose();
  };

  return (
    <>
      {/* List Modal */}
      <Modal animationType="slide" transparent visible={visible && !detailVisible} onRequestClose={handleParentClose}>
        <View style={styles.overlay}>
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Available Parking Spaces</Text>
              <TouchableOpacity onPress={handleParentClose}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={spaces}
              keyExtractor={(item) => item.id.toString()}
              numColumns={2}
              columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 12 }}
              contentContainerStyle={{ paddingBottom: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => openDetail(item)} style={styles.card} activeOpacity={0.8}>
                  <Image
                    source={item.image ? { uri: item.image } : FALLBACK_IMAGE}
                    style={styles.image}
                    resizeMode="cover"
                  />
                  <Text style={styles.name}>{`${item.category ?? 'Other'} / ${item.space_number}`}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Ionicons name="location-outline" size={12} color="#FF3B30" />
                    <Text style={styles.address} numberOfLines={1}>{item.address ?? item.section}</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceMain}>₱{item.daily_rate}</Text>
                    <Text style={styles.priceUnit}>/day</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <Text style={{ color: '#ccc', textAlign: 'center' }}>No spaces available.</Text>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Details Modal */}
      <ParkingDetails
        visible={detailVisible}
        onClose={closeDetail}
        space={selectedSpace}
        onStartBooking={(booking) => {
          // Forward to parent
          try {
            onStartBooking && onStartBooking(booking);
          } finally {
            // Close both the details and the list modal after initiating booking
            closeDetail();
            onClose();
          }
        }}
      />
    </>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Raleway-Bold',
    fontSize: 18,
    color: '#FFD700',
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 16,
    width: (width * 0.9 - 36) / 2, // container 90% width minus spacing -> split 2 columns
    marginBottom: 16,
    padding: 10,

    // Shadow / elevation
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  image: {
    width: '100%',
    height: 100,
    borderRadius: 12,
  },
  name: {
    fontFamily: 'Raleway-Bold',
    fontSize: 14,
    color: '#fff',
    marginTop: 8,
  },
  address: {
    fontFamily: 'Raleway-Regular',
    fontSize: 11,
    color: '#ccc',
    marginLeft: 4,
    flexShrink: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 6,
  },
  priceMain: {
    fontFamily: 'Rakkas-Regular',
    color: '#FFD700',
    fontSize: 20,
  },
  priceUnit: {
    fontFamily: 'Rakkas-Regular',
    color: '#FFD700',
    fontSize: 12,
    marginLeft: 2,
  },
});

export default ParkingSeeMoreModal;