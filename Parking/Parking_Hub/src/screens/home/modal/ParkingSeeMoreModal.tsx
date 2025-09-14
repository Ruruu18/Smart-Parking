import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ParkingDetails from './ParkingDetails';
import {
  createResponsiveStyles,
  scaledFont,
  scaledSpacing,
  getModalWidth,
  getCardPadding,
  SCREEN_WIDTH
} from '../../../utils/responsive';

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

const createStyles = () => {
  const responsive = createResponsiveStyles();
  const modalWidth = getModalWidth();
  const cardPadding = getCardPadding();
  
  const cardWidth = responsive.isSmallScreen 
    ? (SCREEN_WIDTH * 0.9 - 24) / 2  // Smaller spacing for small screens
    : (SCREEN_WIDTH * 0.9 - 36) / 2; // Original spacing for larger screens
  
  const imageHeight = responsive.isSmallScreen ? 80 : responsive.isMediumScreen ? 90 : 100;
  
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      width: modalWidth,
      maxHeight: '85%',
      backgroundColor: '#1a1a1a',
      borderRadius: 20,
      paddingVertical: scaledSpacing(8),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: responsive.padding,
      marginBottom: scaledSpacing(8),
    },
    title: {
      fontFamily: 'Raleway-Bold',
      fontSize: scaledFont(18),
      color: '#FFD700',
    },
    card: {
      backgroundColor: '#111',
      borderRadius: 16,
      width: cardWidth,
      marginBottom: scaledSpacing(16),
      padding: cardPadding,

      // Shadow / elevation
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 5,
    },
    image: {
      width: '100%',
      height: imageHeight,
      borderRadius: 12,
    },
    name: {
      fontFamily: 'Raleway-Bold',
      fontSize: scaledFont(14),
      color: '#fff',
      marginTop: scaledSpacing(8),
    },
    address: {
      fontFamily: 'Raleway-Regular',
      fontSize: scaledFont(11),
      color: '#ccc',
      marginLeft: 4,
      flexShrink: 1,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginTop: scaledSpacing(6),
    },
    priceMain: {
      fontFamily: 'Rakkas-Regular',
      color: '#FFD700',
      fontSize: scaledFont(20),
    },
    priceUnit: {
      fontFamily: 'Rakkas-Regular',
      color: '#FFD700',
      fontSize: scaledFont(12),
      marginLeft: 2,
    },
  });
};

const styles = createStyles();

export default ParkingSeeMoreModal;