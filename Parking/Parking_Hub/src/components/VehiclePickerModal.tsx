import React, { useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVehicles } from '../contexts/vehicles/VehicleContext';
import VehicleManagementModal from './VehicleManagementModal';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (vehicleId: string) => void;
  // When provided, only vehicles of this type are shown (e.g., 'car')
  filterType?: string;
}

const VehiclePickerModal: React.FC<Props> = ({ visible, onClose, onSelect, filterType }) => {
  const { vehicles } = useVehicles();
  const [showManagementModal, setShowManagementModal] = useState(false);

  const normalizedFilter = useMemo(() => (filterType ?? '').toLowerCase().trim(), [filterType]);
  const filteredVehicles = useMemo(() => {
    if (!normalizedFilter) return vehicles;
    return vehicles.filter(v => v.vehicle_type.toLowerCase() === normalizedFilter);
  }, [vehicles, normalizedFilter]);

  const getVehicleTypeIcon = (type: string) => {
    const iconMap: { [key: string]: string } = {
      car: 'car-sport-outline',
      truck: 'car-outline',
      van: 'bus-outline',
      pickup: 'car-outline',
      bike: 'bicycle-outline',
      motorcycle: 'bicycle-outline',
      scooter: 'hardware-chip-outline'
    };
    return iconMap[type] || 'car-outline';
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color="#FFD700" />
          </TouchableOpacity>
          <Text style={styles.title}>Vehicle Management</Text>

          <FlatList
            data={filteredVehicles}
            keyExtractor={(v) => v.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.item} onPress={() => { onSelect(item.id); onClose(); }}>
                <Ionicons name={getVehicleTypeIcon(item.vehicle_type) as any} size={20} color="#FFD700" />
                <View style={styles.vehicleInfo}>
                  <Text style={styles.itemText}>{item.vehicle_model}</Text>
                  <Text style={styles.itemSubText}>{item.vehicle_type.charAt(0).toUpperCase() + item.vehicle_type.slice(1)} • {item.vehicle_plate_number}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 20 }}>
                <Text style={{ color: '#ccc', marginBottom: 8 }}>No {normalizedFilter || ''} vehicles yet.</Text>
                <Text style={{ color: '#666', fontSize: 12, textAlign: 'center' }}>
                  {normalizedFilter ? `Add your ${normalizedFilter} in the manager to select it for booking.` : 'Add your vehicles in the main menu to select them for booking.'}
                </Text>
              </View>
            }
          />

          {filteredVehicles.length === 0 ? (
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowManagementModal(true)}>
              <Ionicons name="car-outline" size={20} color="#000" />
              <Text style={styles.actionText}>Add {normalizedFilter ? normalizedFilter.charAt(0).toUpperCase() + normalizedFilter.slice(1) : 'Your First Vehicle'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowManagementModal(true)}>
              <Ionicons name="settings-outline" size={20} color="#000" />
              <Text style={styles.actionText}>Manage Vehicles</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Vehicle Management Modal */}
      <VehicleManagementModal
        visible={showManagementModal}
        onClose={() => setShowManagementModal(false)}
        restrictType={normalizedFilter ? (normalizedFilter as any) : undefined}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  container: { width: '90%', backgroundColor: '#1a1a1a', borderRadius: 20, padding: 20 },
  closeBtn: { position: 'absolute', top: 12, right: 12 },
  title: { color: '#fff', fontFamily: 'Raleway-Bold', fontSize: 20, marginBottom: 12, alignSelf: 'center' },
  item: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 8
  },
  vehicleInfo: { marginLeft: 12, flex: 1 },
  itemText: { color: '#fff', fontFamily: 'Raleway-SemiBold', fontSize: 16 },
  itemSubText: { color: '#ccc', fontFamily: 'Rakkas-Regular', fontSize: 14, marginTop: 2 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFD700', padding: 12, borderRadius: 10, marginTop: 16, justifyContent: 'center' },
  actionText: { marginLeft: 6, fontWeight: 'bold' },
});

export default VehiclePickerModal;
